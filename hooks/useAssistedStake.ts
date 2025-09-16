import * as solanaStakePool from '@solana/spl-stake-pool';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  Transaction,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { JITO_STAKE_POOL_ADDRESS } from '../constants';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useNetwork } from '../components/NetworkProvider';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

/**
 * Hook for staking SOL using the assisted (SPL stake pool) method
 */
export const useAssistedStake = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const { network } = useNetwork();

  /**
   * Stakes SOL using the SPL stake pool library
   * @param amount - Amount of SOL to stake (in SOL, not lamports)
   */
  const stake = async (amount: number): Promise<boolean> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      toast.error('Wallet not connected');
      return false;
    }

    setIsLoading(true);
    setTxSignature(null);

    const toastId = toast.loading('Preparing staking transaction...');

    try {
      console.log(`Staking ${amount} SOL using assisted method...`);
      
      // Convert SOL to lamports
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
      
      // Get deposit instructions from SPL stake pool library
      const { instructions, signers } = await solanaStakePool.depositSol(
        connection as any,
        JITO_STAKE_POOL_ADDRESS,
        wallet.publicKey,
        lamports
      );
      
      // Create transaction
      const transaction = new Transaction();
      
      // Add compute budget instruction (optional but recommended for complex transactions)
      const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: 400_000,
      });
      transaction.add(computeBudgetIx);
      
      // Add deposit instructions
      transaction.add(...instructions);
      
      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;
      
      // Sign with any additional signers from the instruction
      if (signers.length > 0) {
        transaction.sign(...signers);
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
      
      console.log('Stake transaction successful:', signature);
      toast.success(
        `Successfully staked SOL to JitoSOL! View: https://solscan.io/tx/${signature}${network === WalletAdapterNetwork.Testnet ? '?cluster=testnet' : ''}`,
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
      console.error('Error in assisted stake:', err);
      toast.dismiss(toastId);
      toast.error('Staking failed. Please try again.');
      return false;
    } finally {
      // Ensure loading state is reset regardless of success or failure
      setIsLoading(false);
    }
  };

  return {
    stake,
    isLoading,
    txSignature,
  };
}; 