import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import Button from './Button';
import { useAssistedStake } from '../hooks/useAssistedStake';
import { useManualStake } from '../hooks/useManualStake';
import { LAMPORTS_PER_SOL, StakeMethod } from '../constants';
import dynamic from 'next/dynamic';

const WalletMultiButton = dynamic(
  () =>
      import('@solana/wallet-adapter-react-ui').then(
          (mod) => mod.WalletMultiButton,
      ),
  { ssr: false },
)

const StakeTab: React.FC = () => {
  const [amount, setAmount] = useState<string>('');
  const [stakeMethod, setStakeMethod] = useState<StakeMethod>(StakeMethod.ASSISTED);
  const wallet = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const assistedStake = useAssistedStake();
  const manualStake = useManualStake();

  // Get wallet SOL balance
  const fetchBalance = async () => {
    if (wallet.publicKey) {
      const balance = await connection.getBalance(wallet.publicKey);
      setBalance(balance / LAMPORTS_PER_SOL);
    }
  };

  // Fetch balance when wallet connects
  useEffect(() => {
    if (wallet?.publicKey) {
      fetchBalance();
    } else {
      setBalance(null);
    }
  }, [wallet?.publicKey, connection?.rpcEndpoint]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || !wallet.publicKey) return;
    
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) return;
    
    let success = false;
    
    try {
      if (stakeMethod === StakeMethod.ASSISTED) {
        success = await assistedStake.stake(amountValue);
      } else {
        success = await manualStake.stake(amountValue);
      }
      
      if (success) {
        setAmount('');
        fetchBalance();
      }
    } catch (error) {
      console.error('Error in StakeTab handleSubmit:', error);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-black">Stake SOL to JitoSOL</h2>
      
      {!wallet.publicKey ? (
        <div className="flex flex-col items-center justify-center py-6">
          <p className="mb-4 text-gray-600">Connect your wallet to get started</p>
          <WalletMultiButton />
        </div>
      ) : (
        <>
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                Amount to Stake
              </label>
              {balance !== null && (
                <span className="text-sm text-gray-500">
                  Balance: {balance.toFixed(4)} SOL
                  <button
                    type="button"
                    className="ml-2 text-purple-600 hover:text-purple-800"
                    onClick={() => setAmount(Math.max(0, balance - 0.01).toString())}
                  >
                    Max
                  </button>
                </span>
              )}
            </div>
            <input
              type="text"
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="w-full p-2 border text-black border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stake Method
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                className={`py-2 px-4 rounded-md ${
                  stakeMethod === StakeMethod.ASSISTED
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
                onClick={() => setStakeMethod(StakeMethod.ASSISTED)}
              >
                Assisted
              </button>
              <button
                type="button"
                className={`py-2 px-4 rounded-md ${
                  stakeMethod === StakeMethod.MANUAL
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
                onClick={() => setStakeMethod(StakeMethod.MANUAL)}
              >
                Manual
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {stakeMethod === StakeMethod.ASSISTED
                ? 'Assisted staking uses the SPL stake pool library for a simplified process.'
                : 'Manual staking constructs the transactions manually for greater control.'}
            </p>
          </div>
          
          <Button
            type="button"
            label="Stake SOL"
            width="full"
            onClick={handleSubmit}
            loading={assistedStake.isLoading || manualStake.isLoading}
            disabled={
              !amount || 
              parseFloat(amount) <= 0 || 
              assistedStake.isLoading || 
              manualStake.isLoading
            }
          />
          
        </>
      )}
    </div>
  );
};

export default StakeTab; 