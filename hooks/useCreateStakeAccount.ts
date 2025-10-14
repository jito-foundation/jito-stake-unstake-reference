import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
    Transaction,
    LAMPORTS_PER_SOL,
    PublicKey,
    ComputeBudgetProgram,
    Keypair,
    SystemProgram,
    StakeProgram,
    TransactionInstruction,
    SYSVAR_CLOCK_PUBKEY,
} from '@solana/web3.js';
import {
    COMPUTE_UNIT_LIMIT_FOR_STAKE_OPERATIONS,
    JITO_STAKE_POOL_ADDRESS,
    STAKE_POOL_PROGRAM_ID,
    JITO_MINT_ADDRESS,
} from '../constants';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useNetwork } from '../components/NetworkProvider';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import * as solanaStakePool from '@solana/spl-stake-pool';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, createApproveInstruction } from '@solana/spl-token';

// Helper to find stake account address
async function findStakeProgramAddress(programId: PublicKey, voteAddress: PublicKey, stakePoolAddress: PublicKey): Promise<PublicKey> {
    const [publicKey] = await PublicKey.findProgramAddress(
        [voteAddress.toBuffer(), stakePoolAddress.toBuffer()],
        programId,
    );
    return publicKey;
}

/**
 * Hook for creating an active stake account via DepositSOL + WithdrawStake in one transaction.
 * This gives you an already-active stake account that can be deposited via the interceptor.
 */
export const useCreateStakeAccount = () => {
    const { connection } = useConnection();
    const wallet = useWallet();
    const [isLoading, setIsLoading] = useState(false);
    const [txSignature, setTxSignature] = useState<string | null>(null);
    const [createdStakeAccount, setCreatedStakeAccount] = useState<PublicKey | null>(null);
    const { network } = useNetwork();

    /**
     * Creates an active stake account by depositing SOL and immediately withdrawing as stake in one transaction
     * @param amount - Amount of SOL to stake (in SOL, not lamports)
     * @returns The created stake account public key if successful
     */
    const createStakeAccount = async (amount: number): Promise<PublicKey | null> => {
        if (!wallet.publicKey || !wallet.signTransaction) {
            toast.error('Wallet not connected');
            return null;
        }

        setIsLoading(true);
        setTxSignature(null);
        setCreatedStakeAccount(null);

        const toastId = toast.loading('Creating active stake account...');

        try {
            console.log(`Creating active stake account with ${amount} SOL...`);

            // Convert SOL to lamports
            const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

            // Get stake pool account to calculate exchange rate
            const stakePoolAccount = await solanaStakePool.getStakePoolAccount(
                connection as any,
                JITO_STAKE_POOL_ADDRESS
            );

            // Calculate how many pool tokens we'll receive from depositing SOL
            // poolTokensOut = (lamports * poolTokenSupply) / totalLamports
            const poolTokenSupply = stakePoolAccount.account.data.poolTokenSupply;
            const totalLamports = stakePoolAccount.account.data.totalLamports;
            const poolTokensToReceive = Number((BigInt(lamports) * BigInt(poolTokenSupply.toString())) / BigInt(totalLamports.toString()));

            console.log(`Will receive ${poolTokensToReceive} pool tokens from deposit`);

            // Get deposit instructions
            const { instructions: depositInstructions, signers: depositSigners } =
                await solanaStakePool.depositSol(
                    connection as any,
                    JITO_STAKE_POOL_ADDRESS,
                    wallet.publicKey,
                    lamports
                );

            // Derive withdraw authority
            const [withdrawAuthority] = PublicKey.findProgramAddressSync(
                [JITO_STAKE_POOL_ADDRESS.toBuffer(), Buffer.from('withdraw')],
                STAKE_POOL_PROGRAM_ID
            );

            // Get user's pool token account
            const userPoolTokenAccount = getAssociatedTokenAddressSync(
                JITO_MINT_ADDRESS,
                wallet.publicKey
            );

            // Find a suitable validator stake account to withdraw from
            const validatorListAccountInfo = await connection.getAccountInfo(
                stakePoolAccount.account.data.validatorList
            );
            if (!validatorListAccountInfo) {
                throw new Error('Failed to fetch validator list');
            }

            const validatorListData = solanaStakePool.ValidatorListLayout.decode(
                validatorListAccountInfo.data
            );

            // Find first active validator with enough balance
            let validatorStakeAddress: PublicKey | null = null;
            const minimumRequiredLamports = 3282880;

            for (const validatorInfo of validatorListData.validators) {
                if (validatorInfo.status !== 0) continue; // Skip inactive

                const voteAddress = validatorInfo.voteAccountAddress;
                const derivedStakeAddress = await findStakeProgramAddress(
                    STAKE_POOL_PROGRAM_ID,
                    voteAddress,
                    JITO_STAKE_POOL_ADDRESS
                );

                const sourceStakeAccInfo = await connection.getAccountInfo(derivedStakeAddress);
                if (!sourceStakeAccInfo) continue;

                const availableLamports = sourceStakeAccInfo.lamports - minimumRequiredLamports;
                const estimatedNeeded = Math.floor(lamports * 2);

                if (availableLamports > estimatedNeeded) {
                    validatorStakeAddress = derivedStakeAddress;
                    console.log(`Found suitable validator stake: ${derivedStakeAddress.toString()}`);
                    break;
                }
            }

            if (!validatorStakeAddress) {
                throw new Error('No suitable validator found with enough balance');
            }

            // Create destination stake account
            const stakeReceiver = Keypair.generate();
            const stakeRentExempt = await connection.getMinimumBalanceForRentExemption(
                StakeProgram.space
            );

            // Create temporary transfer authority for token approval
            const transferAuthority = Keypair.generate();

            // Create single transaction with both operations
            const transaction = new Transaction();

            // Add compute budget
            transaction.add(
                ComputeBudgetProgram.setComputeUnitLimit({
                    units: COMPUTE_UNIT_LIMIT_FOR_STAKE_OPERATIONS * 3,
                })
            );

            // Add deposit instructions
            transaction.add(...depositInstructions);

            // Add token approval for withdraw
            transaction.add(
                createApproveInstruction(
                    userPoolTokenAccount,
                    transferAuthority.publicKey,
                    wallet.publicKey,
                    poolTokensToReceive
                )
            );

            // Create destination stake account
            transaction.add(
                SystemProgram.createAccount({
                    fromPubkey: wallet.publicKey,
                    newAccountPubkey: stakeReceiver.publicKey,
                    lamports: stakeRentExempt,
                    space: StakeProgram.space,
                    programId: StakeProgram.programId,
                })
            );

            // Manually build withdraw stake instruction
            const withdrawStakeIx = new TransactionInstruction({
                programId: STAKE_POOL_PROGRAM_ID,
                keys: [
                    { pubkey: JITO_STAKE_POOL_ADDRESS, isSigner: false, isWritable: true },
                    { pubkey: stakePoolAccount.account.data.validatorList, isSigner: false, isWritable: true },
                    { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
                    { pubkey: validatorStakeAddress, isSigner: false, isWritable: true },
                    { pubkey: stakeReceiver.publicKey, isSigner: false, isWritable: true },
                    { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
                    { pubkey: transferAuthority.publicKey, isSigner: true, isWritable: false },
                    { pubkey: userPoolTokenAccount, isSigner: false, isWritable: true },
                    { pubkey: stakePoolAccount.account.data.managerFeeAccount, isSigner: false, isWritable: true },
                    { pubkey: stakePoolAccount.account.data.poolMint, isSigner: false, isWritable: true },
                    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
                    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                    { pubkey: StakeProgram.programId, isSigner: false, isWritable: false },
                ],
                data: (() => {
                    const dataLayout = Buffer.alloc(9);
                    dataLayout.writeUInt8(10, 0); // Instruction index 10 for WithdrawStake
                    dataLayout.writeBigInt64LE(BigInt(poolTokensToReceive), 1);
                    return dataLayout;
                })(),
            });
            transaction.add(withdrawStakeIx);

            // Get recent blockhash
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = wallet.publicKey;

            // Sign with all required signers
            const allSigners = [stakeReceiver, transferAuthority, ...depositSigners];
            transaction.sign(...allSigners);

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

            console.log('Stake account created successfully:', signature);
            console.log('Stake account address:', stakeReceiver.publicKey.toString());

            setCreatedStakeAccount(stakeReceiver.publicKey);

            toast.success(
                `Active stake account created! Address: ${stakeReceiver.publicKey.toString().slice(0, 8)}... View: https://solscan.io/tx/${signature}${network === WalletAdapterNetwork.Testnet ? '?cluster=testnet' : ''}`,
                {
                    id: toastId,
                    duration: 10000,
                    style: {
                        overflowWrap: 'break-word',
                        wordBreak: 'break-word',
                    },
                }
            );
            return stakeReceiver.publicKey;
        } catch (err: any) {
            console.error('Error creating stake account:', err);
            toast.dismiss(toastId);
            toast.error('Failed to create stake account. Please try again.');
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        createStakeAccount,
        isLoading,
        txSignature,
        createdStakeAccount,
    };
};
