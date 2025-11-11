import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  Transaction,
  LAMPORTS_PER_SOL,
  PublicKey,
  ComputeBudgetProgram,
  SystemProgram,
  TransactionInstruction,
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
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { useNetwork } from '../components/NetworkProvider';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

/**
 * Hook for manually depositing SOL to the Jito stake pool (without using SPL stake pool library functions)
 * Note: This implementation uses the wallet directly as the funding account,
 * unlike the standard SPL stake pool library which creates an ephemeral account
 * and transfers SOL to it first. Both approaches work - we chose the direct
 * method for simplicity.
 */
export const useManualSolDeposit = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const { network } = useNetwork();

  /**
   * Manually creates and sends a transaction to deposit SOL
   * @param amount - Amount of SOL to deposit (in SOL, not lamports)
   */
  const depositSol = async (amount: number): Promise<boolean> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      toast.error('Wallet not connected');
      return false;
    }

    setIsLoading(true);
    setTxSignature(null);

    const toastId = toast.loading('Preparing SOL deposit transaction...');

    try {
      console.log(`Depositing ${amount} SOL using manual method...`);

      // Convert SOL to lamports
      const lamportsToDeposit = Math.floor(amount * LAMPORTS_PER_SOL);

      // Get stake pool data to extract addresses
      const stakePoolAccount = await getStakePoolAccount(connection as any, JITO_STAKE_POOL_ADDRESS);

      if (!stakePoolAccount) {
        throw new Error('Failed to get stake pool account data');
      }

      const [withdrawAuthority] = await PublicKey.findProgramAddress(
        [JITO_STAKE_POOL_ADDRESS.toBuffer(), Buffer.from('withdraw')],
        STAKE_POOL_PROGRAM_ID
      );

      const instructions = [];

      const associatedAddress = getAssociatedTokenAddressSync(stakePoolAccount.account.data.poolMint, wallet.publicKey);
      instructions.push(
        createAssociatedTokenAccountIdempotentInstruction(
          wallet.publicKey,
          associatedAddress,
          wallet.publicKey,
          stakePoolAccount.account.data.poolMint
        )
      );
      const destinationTokenAccount = associatedAddress;

      // Note: Using wallet directly as funding account (no ephemeral transfer like in spl stake pool library)
      const keys = [
        { pubkey: JITO_STAKE_POOL_ADDRESS, isSigner: false, isWritable: true },
        { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
        { pubkey: stakePoolAccount.account.data.reserveStake, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: destinationTokenAccount, isSigner: false, isWritable: true },
        { pubkey: stakePoolAccount.account.data.managerFeeAccount, isSigner: false, isWritable: true },
        { pubkey: destinationTokenAccount, isSigner: false, isWritable: true },
        { pubkey: stakePoolAccount.account.data.poolMint, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ];
      const txIx = new TransactionInstruction({
        programId: STAKE_POOL_PROGRAM_ID,
        keys,
        data: (() => {
          // Create a buffer for the instruction data
          const dataLayout = Buffer.alloc(9); // 1 byte for instruction index + 8 bytes for lamports
          dataLayout.writeUInt8(14, 0); // Instruction index 14 for DepositSol
          dataLayout.writeBigInt64LE(BigInt(lamportsToDeposit), 1); // Write lamports as a 64-bit integer
          return dataLayout;
        })(),
      });

      // todo add compute budget instruction

      const setComputeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: COMPUTE_UNIT_LIMIT_FOR_STAKE_OPERATIONS,
      });
      instructions.push(setComputeUnitLimitIx);

      instructions.push(txIx);

      const transaction = new Transaction();

      transaction.add(...instructions);

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      // Sign with wallet
      const signedTransaction = await wallet.signTransaction(transaction);

      toast.loading('Sending transaction...', { id: toastId });

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

      console.log('Manual SOL deposit transaction successful:', signature);
      toast.success(
        `Successfully deposited SOL to JitoSOL! View: https://solscan.io/tx/${signature}${network === WalletAdapterNetwork.Testnet ? '?cluster=testnet' : ''}`,
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
      console.error('SOL deposit error:', e);
      toast.dismiss(toastId);
      toast.error('SOL deposit failed. Please try again.');
      return false;
    } finally {
      // Always reset loading state
      setIsLoading(false);
    }
  };

  return {
    depositSol,
    isLoading,
    txSignature,
  };
};
