import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
    Transaction,
    LAMPORTS_PER_SOL,
    PublicKey,
    ComputeBudgetProgram,
    SystemProgram,
    StakeProgram,
    SYSVAR_CLOCK_PUBKEY,
    SYSVAR_STAKE_HISTORY_PUBKEY,
    TransactionInstruction,
    Keypair,
    StakeAuthorizationLayout,
} from '@solana/web3.js';
import {
    COMPUTE_UNIT_LIMIT_FOR_STAKE_OPERATIONS,
    JITO_STAKE_POOL_ADDRESS,
    STAKE_POOL_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
} from '../constants';
import { useState } from 'react';
import { getStakePoolAccount } from '@solana/spl-stake-pool';
import toast from 'react-hot-toast';
import {
    createAssociatedTokenAccountIdempotentInstruction,
    getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { useNetwork } from '../components/NetworkProvider';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

// Stake Deposit Interceptor Program ID
const STAKE_DEPOSIT_INTERCEPTOR_PROGRAM_ID = new PublicKey(
    '5TAiuAh3YGDbwjEruC1ZpXTJWdNDS7Ur7VeqNNiHMmGV'
);

/**
 * Hook for manually depositing stake accounts to the Jito stake pool.
 * This method constructs the transaction manually using the stake-deposit-interceptor wrapper program.
 */
export const useManualStakeDeposit = () => {
    const { connection } = useConnection();
    const wallet = useWallet();
    const [isLoading, setIsLoading] = useState(false);
    const [txSignature, setTxSignature] = useState<string | null>(null);
    const { network } = useNetwork();

    /**
     * Manually deposits an existing stake account to the pool
     * @param stakeAccountAddress - The address of the existing stake account to deposit
     */
    const depositStakeAccount = async (stakeAccountAddress: PublicKey): Promise<boolean> => {
        if (!wallet.publicKey || !wallet.signTransaction) {
            toast.error('Wallet not connected');
            return false;
        }

        setIsLoading(true);
        setTxSignature(null);

        const toastId = toast.loading('Preparing stake deposit transaction...');

        try {
            console.log(
                `Depositing stake account ${stakeAccountAddress.toString()} using manual stake deposit method...`
            );

            // Fetch the stake account to get the validator vote account
            const stakeAccountInfo = await connection.getAccountInfo(stakeAccountAddress);
            if (!stakeAccountInfo) {
                throw new Error('Stake account not found');
            }

            // Parse stake account data to get the vote account
            // Stake account structure: first 44 bytes are metadata, then StakeMeta, then Stake
            // Vote account pubkey is at offset 124 (32 bytes for meta + 12 bytes for rent exempt reserve + 80 bytes for authorized)
            const VOTE_ACCOUNT_OFFSET = 124;
            const validatorVoteAccount = new PublicKey(
                stakeAccountInfo.data.slice(VOTE_ACCOUNT_OFFSET, VOTE_ACCOUNT_OFFSET + 32)
            );

            console.log(`Detected validator vote account: ${validatorVoteAccount.toString()}`);

            // Get stake pool data
            const stakePoolAccount = await getStakePoolAccount(
                connection as any,
                JITO_STAKE_POOL_ADDRESS
            );

            if (!stakePoolAccount) {
                throw new Error('Failed to get stake pool account data');
            }

            // Derive withdraw authority
            const [withdrawAuthority] = PublicKey.findProgramAddressSync(
                [JITO_STAKE_POOL_ADDRESS.toBuffer(), Buffer.from('withdraw')],
                STAKE_POOL_PROGRAM_ID
            );

            // Derive validator stake account
            const [validatorStake] = PublicKey.findProgramAddressSync(
                [
                    validatorVoteAccount.toBuffer(),
                    JITO_STAKE_POOL_ADDRESS.toBuffer(),
                    Buffer.alloc(0),
                ],
                STAKE_POOL_PROGRAM_ID
            );

            const instructions: TransactionInstruction[] = [];

            // Add compute budget
            const setComputeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
                units: COMPUTE_UNIT_LIMIT_FOR_STAKE_OPERATIONS,
            });
            instructions.push(setComputeUnitLimitIx);

            // Create or get associated token account for JitoSOL
            const poolMint = stakePoolAccount.account.data.poolMint;
            const associatedAddress = getAssociatedTokenAddressSync(poolMint, wallet.publicKey);
            instructions.push(
                createAssociatedTokenAccountIdempotentInstruction(
                    wallet.publicKey,
                    associatedAddress,
                    wallet.publicKey,
                    poolMint
                )
            );
            const poolTokenReceiverAccount = associatedAddress;

            // Fetch the deposit stake authority account to get the vault
            const depositStakeAuthority = stakePoolAccount.account.data.stakeDepositAuthority;
            const depositStakeAuthorityInfo = await connection.getAccountInfo(
                depositStakeAuthority
            );

            if (!depositStakeAuthorityInfo) {
                throw new Error('Failed to fetch deposit stake authority account');
            }

            // Parse the vault address from the deposit stake authority account
            // The vault is at offset 9 (1 byte discriminator + 8 bytes for u64)
            const vault = new PublicKey(depositStakeAuthorityInfo.data.slice(9, 41));

            // Authorize the stake pool deposit authority for both staker and withdrawer
            instructions.push(
                ...StakeProgram.authorize({
                    stakePubkey: stakeAccountAddress,
                    authorizedPubkey: wallet.publicKey,
                    newAuthorizedPubkey: depositStakeAuthority,
                    stakeAuthorizationType: StakeAuthorizationLayout.Staker,
                }).instructions
            );
            instructions.push(
                ...StakeProgram.authorize({
                    stakePubkey: stakeAccountAddress,
                    authorizedPubkey: wallet.publicKey,
                    newAuthorizedPubkey: depositStakeAuthority,
                    stakeAuthorizationType: StakeAuthorizationLayout.Withdrawer,
                }).instructions
            );

            // Generate base keypair for the deposit receipt PDA
            const base = Keypair.generate();

            // Derive DepositReceipt Address
            const [depositReceiptAddress] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('deposit_receipt'),
                    JITO_STAKE_POOL_ADDRESS.toBuffer(),
                    base.publicKey.toBuffer(),
                ],
                STAKE_DEPOSIT_INTERCEPTOR_PROGRAM_ID
            );

            // Manually construct the DepositStake instruction
            // Instruction discriminator is 2 for DepositStake
            const instructionData = Buffer.alloc(33); // 1 byte discriminator + 32 bytes for owner pubkey
            instructionData.writeUInt8(2, 0); // DepositStake instruction discriminator
            wallet.publicKey.toBuffer().copy(instructionData, 1); // owner pubkey

            const depositStakeKeys = [
                { pubkey: wallet.publicKey, isSigner: true, isWritable: true }, // payer
                { pubkey: STAKE_POOL_PROGRAM_ID, isSigner: false, isWritable: false }, // stakePoolProgram
                { pubkey: depositReceiptAddress, isSigner: false, isWritable: true }, // depositReceipt
                { pubkey: JITO_STAKE_POOL_ADDRESS, isSigner: false, isWritable: true }, // stakePool
                {
                    pubkey: stakePoolAccount.account.data.validatorList,
                    isSigner: false,
                    isWritable: true,
                }, // validatorStakeList
                { pubkey: depositStakeAuthority, isSigner: false, isWritable: false }, // depositStakeAuthority
                { pubkey: base.publicKey, isSigner: true, isWritable: false }, // base
                { pubkey: withdrawAuthority, isSigner: false, isWritable: false }, // stakePoolWithdrawAuthority
                { pubkey: stakeAccountAddress, isSigner: false, isWritable: true }, // stake
                { pubkey: validatorStake, isSigner: false, isWritable: true }, // validatorStakeAccount
                {
                    pubkey: stakePoolAccount.account.data.reserveStake,
                    isSigner: false,
                    isWritable: true,
                }, // reserveStakeAccount
                { pubkey: vault, isSigner: false, isWritable: true }, // vault
                {
                    pubkey: stakePoolAccount.account.data.managerFeeAccount,
                    isSigner: false,
                    isWritable: true,
                }, // managerFeeAccount
                {
                    pubkey: poolTokenReceiverAccount,
                    isSigner: false,
                    isWritable: true,
                }, // referrerPoolTokensAccount
                { pubkey: poolMint, isSigner: false, isWritable: true }, // poolMint
                { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false }, // clock
                { pubkey: SYSVAR_STAKE_HISTORY_PUBKEY, isSigner: false, isWritable: false }, // stakeHistory
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // tokenProgram
                { pubkey: StakeProgram.programId, isSigner: false, isWritable: false }, // stakeProgram
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // systemProgram
            ];

            const depositStakeIx = new TransactionInstruction({
                programId: STAKE_DEPOSIT_INTERCEPTOR_PROGRAM_ID,
                keys: depositStakeKeys,
                data: instructionData,
            });

            instructions.push(depositStakeIx);

            // Create transaction
            const transaction = new Transaction();
            transaction.add(...instructions);

            // Get recent blockhash
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(
                'finalized'
            );
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = wallet.publicKey;

            // Sign with base keypair
            transaction.sign(base);

            toast.loading('Sending transaction...', { id: toastId });

            // Sign with wallet
            const signedTransaction = await wallet.signTransaction(transaction);

            // Send transaction
            const signature = await connection.sendRawTransaction(signedTransaction.serialize());
            setTxSignature(signature);

            toast.loading('Confirming transaction...', { id: toastId });

            // Confirm transaction
            await connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight,
            });

            console.log('Manual stake deposit transaction successful:', signature);
            toast.success(
                `Successfully deposited stake to JitoSOL! View: https://solscan.io/tx/${signature}${network === WalletAdapterNetwork.Testnet ? '?cluster=testnet' : ''}`,
                {
                    id: toastId,
                    duration: 8000,
                    style: {
                        overflowWrap: 'break-word',
                        wordBreak: 'break-word',
                    },
                }
            );
            return true;
        } catch (e: any) {
            console.error('Stake deposit error:', e);
            toast.dismiss(toastId);
            toast.error('Stake deposit failed. Please try again.');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        depositStakeAccount,
        isLoading,
        txSignature,
    };
};
