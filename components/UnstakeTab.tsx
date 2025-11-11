import React, { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import Button from './Button';
import { useAssistedUnstake, UnstakeParams } from '../hooks/useAssistedUnstake';
import { useManualUnstake } from '../hooks/useManualUnstake';
import { StakeMethod } from '../constants';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { JITO_MINT_ADDRESS } from '../constants';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import { PublicKey } from '@solana/web3.js';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

const UnstakeTab: React.FC = () => {
  const [amount, setAmount] = useState<string>('');
  const [unstakeMethod, setUnstakeMethod] = useState<StakeMethod>(StakeMethod.ASSISTED_UNSTAKE);
  const [useReserve, setUseReserve] = useState<boolean>(false);
  const [stakeReceiver, setStakeReceiver] = useState<string>('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(true);

  const wallet = useWallet();
  const { connection } = useConnection();
  const [jitoSolBalance, setJitoSolBalance] = useState<number | null>(null);
  const assistedUnstake = useAssistedUnstake();
  const manualUnstake = useManualUnstake();

  // Get wallet JitoSOL balance
  const fetchBalance = useCallback(async () => {
    if (wallet.publicKey) {
      try {
        const userPoolTokenAccount = getAssociatedTokenAddressSync(JITO_MINT_ADDRESS, wallet.publicKey);

        // Check if the account exists
        const accountInfo = await connection.getAccountInfo(userPoolTokenAccount);

        if (!accountInfo) {
          setJitoSolBalance(0);
          return;
        }

        // Get token account data
        const tokenAccountInfo = await connection.getTokenAccountBalance(userPoolTokenAccount);
        const balance = tokenAccountInfo.value.uiAmount || 0;
        setJitoSolBalance(balance);
      } catch (error) {
        console.error('Error fetching JitoSOL balance:', error);
        toast.error('Failed to fetch JitoSOL balance');
        setJitoSolBalance(0);
      }
    }
  }, [wallet.publicKey, connection]);

  // Fetch balance when wallet connects
  useEffect(() => {
    if (wallet?.publicKey) {
      fetchBalance();
    } else {
      setJitoSolBalance(null);
    }
  }, [wallet?.publicKey, fetchBalance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || !wallet.publicKey) return;

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) return;

    let success = false;

    try {
      if (unstakeMethod === StakeMethod.ASSISTED_UNSTAKE) {
        // Prepare additional parameters for assisted unstake
        const params: UnstakeParams = {
          useReserve: useReserve,
        };

        // Add stake receiver if provided
        if (!useReserve && showAdvancedOptions && stakeReceiver) {
          try {
            params.stakeReceiver = new PublicKey(stakeReceiver);
          } catch {
            toast.error('Invalid stake receiver address');
            return;
          }
        }

        // amount value is in JitoSOL -- not decimal adjusted
        success = await assistedUnstake.unstake(amountValue, params);
      } else {
        // Manual unstake - uses preferred validators API
        success = await manualUnstake.unstake(amountValue);
      }

      if (success) {
        setAmount('');
        fetchBalance();
      }
    } catch (error) {
      console.error('Error in unstake submission:', error);
      toast.error('Unstaking failed. Please check console for details.');
    }
  };

  return (
    <div className="w-full mx-auto p-2 sm:p-6 bg-white">
      <h2 className="text-2xl font-bold mb-6 text-black">Unstake JitoSOL to SOL</h2>

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
                Amount to Unstake
              </label>
              {jitoSolBalance !== null && (
                <div className="text-sm text-gray-500 text-right">
                  Balance: {jitoSolBalance.toFixed(4)} jitoSOL
                  <button
                    type="button"
                    className="ml-2 text-purple-600 hover:text-purple-800"
                    onClick={() => setAmount(jitoSolBalance.toString())}
                  >
                    Max
                  </button>
                </div>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Unstake Method</label>
            <div className="flex gap-4">
              <button
                type="button"
                className={`py-2 px-4 rounded-md ${
                  unstakeMethod === StakeMethod.ASSISTED_UNSTAKE
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
                onClick={() => setUnstakeMethod(StakeMethod.ASSISTED_UNSTAKE)}
              >
                Assisted
              </button>
              <button
                type="button"
                className={`py-2 px-4 rounded-md ${
                  unstakeMethod === StakeMethod.MANUAL_UNSTAKE
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
                onClick={() => setUnstakeMethod(StakeMethod.MANUAL_UNSTAKE)}
              >
                Manual
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {unstakeMethod === StakeMethod.ASSISTED_UNSTAKE
                ? 'Assisted unstaking uses the SPL stake pool library.'
                : 'Manual unstaking constructs the transactions manually.'}
            </p>
          </div>

          {unstakeMethod === StakeMethod.ASSISTED_UNSTAKE && (
            <div className="mb-6">
              <div className="flex items-center">
                <input
                  id="useReserve"
                  type="checkbox"
                  checked={useReserve}
                  onChange={(e) => setUseReserve(e.target.checked)}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <label htmlFor="useReserve" className="ml-2 block text-sm text-gray-700">
                  Use reserve
                </label>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                {useReserve ? 'Receive SOL immediately with a fee.' : 'Receive SOL after the next epoch with no fee.'}
              </p>
            </div>
          )}

          {/* Advanced options for assisted unstaking without reserve */}
          {unstakeMethod === StakeMethod.ASSISTED_UNSTAKE && !useReserve && (
            <div className="mb-6">
              <button
                type="button"
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="text-sm text-purple-600 hover:text-purple-800"
              >
                {showAdvancedOptions ? 'Hide advanced options' : 'Show advanced options'}
              </button>

              {showAdvancedOptions && (
                <div className="mt-4 space-y-4 border p-4 rounded-md border-gray-200">
                  <div>
                    <label htmlFor="stakeReceiver" className="block text-sm font-medium text-gray-700 mb-1">
                      Stake Receiver Address (optional)
                    </label>
                    <input
                      type="text"
                      id="stakeReceiver"
                      value={stakeReceiver}
                      onChange={(e) => setStakeReceiver(e.target.value)}
                      placeholder="Stake account to receive withdrawn SOL"
                      className="w-full p-2 border text-black border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Existing stake account to receive unstaked SOL. Must be delegated to the same validator if
                      specified above.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <Button
            type="button"
            label="Unstake JitoSOL"
            width="full"
            onClick={handleSubmit}
            loading={assistedUnstake.isLoading || manualUnstake.isLoading}
            disabled={!amount || parseFloat(amount) <= 0 || assistedUnstake.isLoading || manualUnstake.isLoading}
          />
        </>
      )}
    </div>
  );
};

export default UnstakeTab;
