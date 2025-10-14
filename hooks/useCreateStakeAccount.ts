import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
    Transaction,
    LAMPORTS_PER_SOL,
    PublicKey,
    ComputeBudgetProgram,
    StakeProgram,
    Keypair,
} from '@solana/web3.js';
import { COMPUTE_UNIT_LIMIT_FOR_STAKE_OPERATIONS } from '../constants';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useNetwork } from '../components/NetworkProvider';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

/**
 * Hook for creating and delegating a stake account.
 * This is the first step before depositing to the stake pool.
 */
export const useCreateStakeAccount = () => {
    const { connection } = useConnection();
    const wallet = useWallet();
    const [isLoading, setIsLoading] = useState(false);
    const [txSignature, setTxSignature] = useState<string | null>(null);
    const [createdStakeAccount, setCreatedStakeAccount] = useState<PublicKey | null>(null);
    const { network } = useNetwork();

    /**
     * Creates a stake account and delegates it to a validator
     * @param amount - Amount of SOL to stake (in SOL, not lamports)
     * @param validatorVoteAccount - The validator vote account to delegate to
     * @returns The created stake account public key if successful
     */
    const createStakeAccount = async (
        amount: number,
        validatorVoteAccount: PublicKey
    ): Promise<PublicKey | null> => {
        if (!wallet.publicKey || !wallet.signTransaction) {
            toast.error('Wallet not connected');
            return null;
        }

        setIsLoading(true);
        setTxSignature(null);
        setCreatedStakeAccount(null);

        const toastId = toast.loading('Creating stake account...');

        try {
            console.log(`Creating stake account with ${amount} SOL...`);

            // Convert SOL to lamports
            const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

            // Create a new stake account
            const stakeAccount = Keypair.generate();

            // Create stake account instruction
            const minimumRent = await connection.getMinimumBalanceForRentExemption(
                StakeProgram.space
            );
            const createStakeAccountIx = StakeProgram.createAccount({
                fromPubkey: wallet.publicKey,
                stakePubkey: stakeAccount.publicKey,
                authorized: {
                    staker: wallet.publicKey,
                    withdrawer: wallet.publicKey,
                },
                lamports: lamports + minimumRent,
            });

            // Delegate stake instruction
            const delegateIx = StakeProgram.delegate({
                stakePubkey: stakeAccount.publicKey,
                authorizedPubkey: wallet.publicKey,
                votePubkey: validatorVoteAccount,
            });

            // Create transaction
            const transaction = new Transaction();

            // Add compute budget instruction
            const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
                units: COMPUTE_UNIT_LIMIT_FOR_STAKE_OPERATIONS,
            });
            transaction.add(computeBudgetIx);

            // Add stake account creation and delegation
            transaction.add(...createStakeAccountIx.instructions);
            transaction.add(delegateIx);

            // Get recent blockhash
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(
                'finalized'
            );
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = wallet.publicKey;

            // Sign with stake account keypair
            transaction.sign(stakeAccount);

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
            console.log('Stake account address:', stakeAccount.publicKey.toString());

            setCreatedStakeAccount(stakeAccount.publicKey);

            toast.success(
                `Stake account created! Address: ${stakeAccount.publicKey.toString().slice(0, 8)}... View: https://solscan.io/tx/${signature}${network === WalletAdapterNetwork.Testnet ? '?cluster=testnet' : ''}`,
                {
                    id: toastId,
                    duration: 10000,
                    style: {
                        overflowWrap: 'break-word',
                        wordBreak: 'break-word',
                    },
                }
            );
            return stakeAccount.publicKey;
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
