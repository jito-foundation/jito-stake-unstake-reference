import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
    Transaction,
    LAMPORTS_PER_SOL,
    PublicKey,
    ComputeBudgetProgram,
    StakeProgram,
    Keypair,
} from '@solana/web3.js';
import { COMPUTE_UNIT_LIMIT_FOR_STAKE_OPERATIONS, JITO_STAKE_POOL_ADDRESS } from '../constants';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useNetwork } from '../components/NetworkProvider';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { depositStake } from '@jito-foundation/stake-deposit-interceptor-sdk';

/**
 * Hook for depositing stake accounts to the Jito stake pool using the assisted (interceptor library) method.
 * This method takes an existing stake account and deposits it into the pool.
 */
export const useAssistedStakeDeposit = () => {
    const { connection } = useConnection();
    const wallet = useWallet();
    const [isLoading, setIsLoading] = useState(false);
    const [txSignature, setTxSignature] = useState<string | null>(null);
    const { network } = useNetwork();

    /**
     * Deposits an existing stake account using the interceptor library
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
                `Depositing stake account ${stakeAccountAddress.toString()} using assisted stake deposit method...`
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

            // Get deposit stake instructions from interceptor library
            const { instructions: depositInstructions, signers: depositSigners } = await depositStake(
                connection,
                wallet.publicKey, // payer
                JITO_STAKE_POOL_ADDRESS,
                wallet.publicKey, // authorizedPubkey
                validatorVoteAccount,
                stakeAccountAddress, // depositStake
            );

            // Create transaction
            const transaction = new Transaction();

            // Add compute budget instruction
            const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
                units: COMPUTE_UNIT_LIMIT_FOR_STAKE_OPERATIONS,
            });
            transaction.add(computeBudgetIx);

            // Add deposit instructions
            transaction.add(...depositInstructions);

            // Get recent blockhash
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(
                'finalized'
            );
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = wallet.publicKey;

            // Sign with any additional signers from the deposit instruction
            if (depositSigners.length > 0) {
                transaction.sign(...depositSigners);
            }

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

            console.log('Stake deposit transaction successful:', signature);
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
        } catch (err: any) {
            console.error('Error in assisted stake deposit:', err);
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
