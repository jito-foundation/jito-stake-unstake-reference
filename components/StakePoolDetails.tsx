import React, { useState } from 'react';
import { StakePoolInfo } from '../hooks/useStakePoolInfo';
import { LAMPORTS_PER_SOL } from '../constants';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

// Simple Copy Icon
const CopyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline ml-1 text-gray-500 hover:text-gray-700 cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

interface StakePoolDetailsProps {
  poolInfo: StakePoolInfo | null;
  isLoading: boolean;
  error: string | null;
}

// Helper to format PublicKey for display
const formatPublicKey = (key: PublicKey) => {
  const keyString = key.toBase58();
  return `${keyString.slice(0, 4)}...${keyString.slice(-4)}`;
};

// Helper to format BN lamports to SOL string
const formatLamports = (lamports: BN | undefined): string => {
  if (lamports === undefined) return 'N/A';
  // Use Number for display purposes, potentially losing precision for huge numbers, but fine for SOL display
  return (Number(lamports.toString()) / LAMPORTS_PER_SOL).toLocaleString(undefined, { maximumFractionDigits: 4 });
};

// Helper to format BN tokens (assuming JitoSOL has 9 decimals like SOL)
const formatPoolTokens = (tokens: BN | undefined): string => {
    if (tokens === undefined) return 'N/A';
    // JitoSOL (pool token) also has 9 decimal places
    return (Number(tokens.toString()) / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 4 });
};

// Helper to format fee percentage
const formatFee = (fee: number | null | undefined): string => {
  if (fee === undefined || fee === null) return 'N/A';
  return `${fee.toFixed(2)}%`;
};

// Helper to format SOL/JitoSOL conversion rate
const formatConversion = (rate: number | undefined): string => {
    if (rate === undefined) return 'N/A';
    // Display how many SOL you get for 1 JitoSOL
    return `${rate.toFixed(6)} SOL / JitoSOL`;
};

// Define type for details array items
interface DetailItem {
  label: string;
  value: string; // Formatted value for display
  rawValue?: string; // Raw value (e.g., full public key) for copying
  type?: 'address' | 'number' | 'percentage' | 'rate';
}

const StakePoolDetails: React.FC<StakePoolDetailsProps> = ({ poolInfo, isLoading, error }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const handleCopy = (text: string | undefined, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedAddress(label); // Set the label of the copied item
      setTimeout(() => setCopiedAddress(null), 1500); // Reset after 1.5 seconds
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  if (isLoading) {
    return <div className="text-center text-gray-500 mb-6">Loading pool details...</div>;
  }

  if (error) {
    return <div className="text-center text-red-500 mb-6">Error loading pool details: {error}</div>;
  }

  if (!poolInfo) {
    return <div className="text-center text-gray-500 mb-6">Stake pool data not available.</div>;
  }

  const allDetails: DetailItem[] = [
    { label: 'Pool Address', value: formatPublicKey(poolInfo.pubkey), rawValue: poolInfo.pubkey.toBase58(), type: 'address' },
    { label: 'Pool Mint', value: formatPublicKey(poolInfo.poolMint), rawValue: poolInfo.poolMint.toBase58(), type: 'address' },
    { label: 'Total SOL Staked', value: formatLamports(poolInfo.totalLamports), type: 'number' },
    { label: 'Total JitoSOL Supply', value: formatPoolTokens(poolInfo.totalPoolTokens), type: 'number' },
    { label: 'SOL per JitoSOL', value: formatConversion(poolInfo.solJitoConversion), type: 'rate' },
    { label: 'Reserve Stake Account', value: formatPublicKey(poolInfo.reserveStake), rawValue: poolInfo.reserveStake.toBase58(), type: 'address' },
    { label: 'Manager', value: formatPublicKey(poolInfo.manager), rawValue: poolInfo.manager.toBase58(), type: 'address' },
    { label: 'Manager Fee Account', value: formatPublicKey(poolInfo.managerFeeAccount), rawValue: poolInfo.managerFeeAccount.toBase58(), type: 'address' },
    { label: 'Validator List', value: formatPublicKey(poolInfo.validatorList), rawValue: poolInfo.validatorList.toBase58(), type: 'address' },
    { label: 'SOL Deposit Fee', value: formatFee(poolInfo.solDepositFee), type: 'percentage' },
    { label: 'Stake Deposit Fee', value: formatFee(poolInfo.stakeDepositFee), type: 'percentage' },
    { label: 'SOL Withdrawal Fee', value: formatFee(poolInfo.solWithdrawalFee), type: 'percentage' },
    { label: 'Stake Withdrawal Fee', value: formatFee(poolInfo.stakeWithdrawalFee), type: 'percentage' },
    { label: 'Epoch Fee', value: formatFee(poolInfo.epochFee), type: 'percentage' },
  ];

  const displayedDetails = isExpanded ? allDetails : allDetails.slice(0, 4); // Show top 4 initially

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-8 border border-gray-200">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4 text-center">Jito Stake Pool Details</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
        {displayedDetails.map(({ label, value, rawValue, type }) => (
          <div key={label} className="flex justify-between items-center py-1 border-b border-gray-100">
            <span className="text-sm font-medium text-gray-600">{label}:</span>
            <span className="text-sm text-gray-800 font-mono flex items-center">
              {value}
              {type === 'address' && rawValue && (
                <button onClick={() => handleCopy(rawValue, label)} title={`Copy ${label}`}>
                  {copiedAddress === label ? (
                    <span className="text-xs text-green-600 ml-1">(Copied!)</span>
                  ) : (
                    <CopyIcon />
                  )}
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
      <div className="text-center mt-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm text-purple-600 hover:text-purple-800 font-medium"
        >
          {isExpanded ? 'Show Less' : 'Show More'}
        </button>
      </div>
       {/* Display raw data for debugging if needed */}
       {/* <pre className="mt-4 text-xs overflow-auto bg-gray-50 p-2 rounded">
         {JSON.stringify(poolInfo, (key, value) =>
           typeof value === 'bigint' ? value.toString() : // Convert BigInt to string for JSON.stringify
           value instanceof PublicKey ? value.toBase58() : // Convert PublicKey to string
           value instanceof BN ? value.toString() : // Convert BN to string
           value,
         2)}
       </pre> */}
    </div>
  );
};

export default StakePoolDetails; 