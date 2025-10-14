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
     * Stakes SOL by creating a stake account and depositing it using the interceptor library
     * @param amount - Amount of SOL to stake (in SOL, not lamports)
     * @param validatorVoteAccount - The validator vote account to delegate to
     */
    const stake = async (amount: number, validatorVoteAccount: PublicKey): Promise<boolean> => {
        if (!wallet.publicKey || !wallet.signTransaction) {
            toast.error('Wallet not connected');
            return false;
        }

        setIsLoading(true);
        setTxSignature(null);

        const toastId = toast.loading('Preparing stake deposit transaction...');

        try {
            console.log(`Staking ${amount} SOL using assisted stake deposit method...`);

            // Convert SOL to lamports
            const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

            // Create a new stake account
            const stakeAccount = Keypair.generate();

            // Create stake account instruction
            const minimumRent = await connection.getMinimumBalanceForRentExemption(StakeProgram.space);
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

            // Get deposit stake instructions from interceptor library
            const { instructions: depositInstructions, signers: depositSigners } = await depositStake(
                connection,
                wallet.publicKey, // payer
                JITO_STAKE_POOL_ADDRESS,
                wallet.publicKey, // authorizedPubkey
                validatorVoteAccount,
                stakeAccount.publicKey, // depositStake
            );

            // Create transaction
            const transaction = new Transaction();

            // Add compute budget instruction
            const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
                units: COMPUTE_UNIT_LIMIT_FOR_STAKE_OPERATIONS * 2,
            });
            transaction.add(computeBudgetIx);

            // Add stake account creation and delegation
            transaction.add(...createStakeAccountIx.instructions);
            transaction.add(delegateIx);

            // Add deposit instructions
            transaction.add(...depositInstructions);

            // Get recent blockhash
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = wallet.publicKey;

            // Sign with stake account and any additional signers from the deposit instruction
            transaction.sign(stakeAccount, ...depositSigners);

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
        stake,
        isLoading,
        txSignature,
    };
};
