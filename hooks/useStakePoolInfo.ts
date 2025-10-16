import { useConnection } from '@solana/wallet-adapter-react';
import { useState, useEffect } from 'react';
import * as solanaStakePool from '@solana/spl-stake-pool';
import { JITO_STAKE_POOL_ADDRESS } from '../constants';
import { PublicKey, AccountInfo } from '@solana/web3.js';
import BN from 'bn.js';

// Helper function to calculate fee percentage
const calculateFeePercentage = (fee: { denominator: BN; numerator: BN } | null): number | null => {
  if (!fee || fee.denominator.isZero()) {
    return null; // Or handle as 0% fee, depending on desired behavior
  }
  // Use floating-point division for percentage calculation
  return (Number(fee.numerator) / Number(fee.denominator)) * 100;
};

export interface StakePoolInfo {
  pubkey: PublicKey;
  account: AccountInfo<solanaStakePool.StakePool>;
  poolMint: PublicKey;
  reserveStake: PublicKey;
  withdrawAuthority: PublicKey;
  validatorList: PublicKey;
  managerFeeAccount: PublicKey;
  manager: PublicKey;
  totalLamports?: BN;
  totalPoolTokens?: BN;
  solJitoConversion?: number;
  stakeDepositFee?: number | null;
  solDepositFee?: number | null;
  stakeWithdrawalFee?: number | null;
  solWithdrawalFee?: number | null;
  epochFee?: number | null;
}

export const useStakePoolInfo = () => {
  const { connection } = useConnection();
  const [poolInfo, setPoolInfo] = useState<StakePoolInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStakePoolInfo = async () => {
      setIsLoading(true);
      setError(null);
      setPoolInfo(null); // Reset pool info on new fetch

      if (!connection) {
          setError("Wallet not connected");
          setIsLoading(false);
          return;
      }

      try {
        // Get stake pool data
        const stakePoolAccount = await solanaStakePool.getStakePoolAccount(
          connection as any,
          JITO_STAKE_POOL_ADDRESS
        );

        if (!stakePoolAccount?.account?.data) {
          throw new Error('Failed to fetch stake pool account data');
        }
        const stakePoolData = stakePoolAccount.account.data;

        // Derive the withdraw authority PDA
        const [withdrawAuthority] = PublicKey.findProgramAddressSync(
          [JITO_STAKE_POOL_ADDRESS.toBuffer(), Buffer.from('withdraw')],
          solanaStakePool.STAKE_POOL_PROGRAM_ID
        );

        // Use BN for totals (as returned by the library)
        const totalLamports = stakePoolData.totalLamports;
        const totalPoolTokens = stakePoolData.poolTokenSupply;

        // Calculate conversion rate safely using BN methods
        const solJitoConversion = !totalPoolTokens.isZero() // Use isZero() for BN comparison
          ? Number(totalLamports.toString()) / Number(totalPoolTokens.toString()) // Convert BN to string then Number for division
          : 0;

        // Calculate fees
        const stakeDepositFee = calculateFeePercentage(stakePoolData.stakeDepositFee);
        const solDepositFee = calculateFeePercentage(stakePoolData.solDepositFee);
        const stakeWithdrawalFee = calculateFeePercentage(stakePoolData.stakeWithdrawalFee);
        const solWithdrawalFee = calculateFeePercentage(stakePoolData.solWithdrawalFee);
        const epochFee = calculateFeePercentage(stakePoolData.epochFee);

        setPoolInfo({
          pubkey: JITO_STAKE_POOL_ADDRESS,
          account: stakePoolAccount.account, // Keep raw account data if needed elsewhere
          poolMint: stakePoolData.poolMint,
          reserveStake: stakePoolData.reserveStake,
          withdrawAuthority,
          validatorList: stakePoolData.validatorList,
          managerFeeAccount: stakePoolData.managerFeeAccount,
          manager: stakePoolData.manager,
          solJitoConversion,
          totalLamports,
          totalPoolTokens,
          stakeDepositFee,
          solDepositFee,
          stakeWithdrawalFee,
          solWithdrawalFee,
          epochFee,
        });
      } catch (err) {
        console.error('Error fetching stake pool info:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch stake pool info');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStakePoolInfo();
  }, [connection?.rpcEndpoint]);

  return { poolInfo, isLoading, error };
}; 