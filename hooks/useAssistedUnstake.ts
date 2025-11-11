import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  Transaction,
  PublicKey,
} from '@solana/web3.js';
import { COMPUTE_UNIT_LIMIT_FOR_STAKE_OPERATIONS, JITO_STAKE_POOL_ADDRESS } from '../constants';
import toast from 'react-hot-toast';
import * as solanaStakePool from '@solana/spl-stake-pool';
import { useNetwork } from '../components/NetworkProvider';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PreferredWithdraw, getPreferredValidatorsApiUrl } from '../utils/preferredValidators';

/**
 * Parameters for unstaking JitoSOL
 */
export interface UnstakeParams {
  useReserve: boolean;
  stakeReceiver?: PublicKey;
}

/**
 * Hook for unstaking JitoSOL using the assisted (SPL stake pool) method
 */
export const useAssistedUnstake = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const { network } = useNetwork();

  /**
   * Unstake JitoSOL tokens using the SPL stake pool method
   *
   * @param {number} amount - Amount of JitoSOL to unstake
   * @param {UnstakeParams} params - Optional parameters for unstaking
   * @returns {Promise<boolean>} - Whether the unstake was successful
   */
  const unstake = async (amount: number, params?: UnstakeParams): Promise<boolean> => {
    // Set default parameters if not provided
    const unstakeParams: UnstakeParams = params || { useReserve: true };

    // Clear previous state
    setIsLoading(true);
    setTxSignature(null);
    const toastId = toast.loading('Preparing unstaking transaction...');

    const stakePoolAccount = await solanaStakePool.getStakePoolAccount(connection as any, JITO_STAKE_POOL_ADDRESS);

    try {
      // Check if wallet is connected
      if (!wallet.publicKey || !wallet.signTransaction) {
        toast.error('Please connect your wallet to unstake', { id: toastId });
        return false;
      }

      // Ensure stake pool is loaded properly
      if (!stakePoolAccount) {
        toast.error('Failed to load stake pool information', { id: toastId });
        return false;
      }

      // Fetch preferred validators from API
      let voteAccountAddress: PublicKey | undefined;

      try {
        toast.loading('Fetching preferred validators...', { id: toastId });
        const apiUrl = getPreferredValidatorsApiUrl(network);

        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const preferredValidators: PreferredWithdraw[] = await response.json();

          if (Array.isArray(preferredValidators) && preferredValidators.length > 0) {
            // Take the first validator from the list
            const selectedValidator = preferredValidators[0];
            voteAccountAddress = new PublicKey(selectedValidator.vote_account);
            console.log(`Using preferred validator: ${voteAccountAddress.toBase58()} (rank ${selectedValidator.rank})`);
          }
        }
      } catch (apiError) {
        console.warn('Failed to fetch preferred validators, will use default:', apiError);
        // Continue without preferred validator - SPL library will auto-select
      }

      // Call withdrawStake with parameters based on the unstake options
      const withdrawStakeArgs = [
        connection, // connection
        JITO_STAKE_POOL_ADDRESS, // stakePoolAddress
        wallet.publicKey, // tokenOwner (added non-null assertion)
        amount, // amount -- in JitoSOL, not decimal adjusted
        unstakeParams.useReserve, // useReserve
      ];

      // Add voteAccountAddress if we have one (from API)
      if (voteAccountAddress) {
        withdrawStakeArgs.push(voteAccountAddress); // voteAccountAddress (6th arg)
      }

      if (unstakeParams.stakeReceiver) {
        // withdrawStake uses positional args. If stakeReceiver (7th) is provided
        // but voteAccountAddress (6th) is not, we must provide a placeholder for the 6th arg.
        if (!voteAccountAddress) {
          withdrawStakeArgs.push(undefined as any);
        }
        withdrawStakeArgs.push(unstakeParams.stakeReceiver); // stakeReceiver (7th arg)
      }

      console.log(
        'withdrawStakeArgs',
        withdrawStakeArgs.map((arg) => arg?.toString())
      );

      const {
        instructions: withdrawInstructions,
        signers,
        stakeReceiver,
      } = await solanaStakePool.withdrawStake(
        ...(withdrawStakeArgs as Parameters<typeof solanaStakePool.withdrawStake>)
      );

      const instructions = [];

      const setComputeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: COMPUTE_UNIT_LIMIT_FOR_STAKE_OPERATIONS,
      });

      instructions.push(setComputeUnitLimitIx);
      instructions.push(...withdrawInstructions);

      const transaction = new Transaction();
      transaction.add(...instructions);

      console.log('stakeReceiver', stakeReceiver?.toString());
      toast.loading(`Processing unstake transaction...`, { id: toastId });

      // Create a versioned transaction
      const latestBlockhash = await connection.getLatestBlockhash();
      const messageV0 = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: transaction.instructions,
      }).compileToV0Message();

      const transactionV0 = new VersionedTransaction(messageV0);

      // If there are signers, we need to sign with those too
      if (signers && signers.length > 0) {
        transactionV0.sign(signers);
      }

      // Sign with wallet
      const signedTransaction = await wallet.signTransaction(transactionV0);

      // Send the transaction
      toast.loading(`Sending transaction to Solana network...`, {
        id: toastId,
      });
      const signature = await connection.sendTransaction(signedTransaction);

      toast.loading(`Confirming transaction...`, { id: toastId });
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');

      if (confirmation.value.err) {
        toast.error(`Transaction failed: ${confirmation.value.err}`, {
          id: toastId,
        });
        return false;
      }

      // Set the transaction signature state
      setTxSignature(signature);

      const solscanLink = `https://solscan.io/tx/${signature}${network === WalletAdapterNetwork.Testnet ? '?cluster=testnet' : ''}`;
      toast.success(`JitoSOL successfully unstaked! View: ${solscanLink}`, {
        id: toastId,
        duration: 8000,
        style: {
          overflowWrap: 'break-word',
          wordBreak: 'break-word',
        },
      });

      return true;
    } catch (error: any) {
      console.error('Error in useAssistedUnstake:', error);
      toast.dismiss(toastId);
      toast.error('Unstaking failed. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    unstake,
    isLoading,
    txSignature,
  };
};
