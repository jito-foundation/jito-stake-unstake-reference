import React, { useState, useEffect, useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import Button from './Button';
import { useAssistedSolDeposit } from '../hooks/useAssistedSolDeposit';
import { useManualSolDeposit } from '../hooks/useManualSolDeposit';
import { useAssistedStakeDeposit } from '../hooks/useAssistedStakeDeposit';
import { useManualStakeDeposit } from '../hooks/useManualStakeDeposit';
import { useCreateStakeAccount } from '../hooks/useCreateStakeAccount';
import { LAMPORTS_PER_SOL, StakeMethod } from '../constants';
import { PublicKey } from '@solana/web3.js';
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
  const [stakeMethod, setStakeMethod] = useState<StakeMethod>(StakeMethod.ASSISTED_SOL_DEPOSIT);
  const [stakeAccountAddress, setStakeAccountAddress] = useState<string>('');
  const wallet = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const assistedSolDeposit = useAssistedSolDeposit();
  const manualSolDeposit = useManualSolDeposit();
  const assistedStakeDeposit = useAssistedStakeDeposit();
  const manualStakeDeposit = useManualStakeDeposit();
  const createStakeAccount = useCreateStakeAccount();

  // Get wallet SOL balance
  const fetchBalance = useCallback(async () => {
    if (wallet.publicKey) {
      const balance = await connection.getBalance(wallet.publicKey);
      setBalance(balance / LAMPORTS_PER_SOL);
    }
  }, [wallet.publicKey, connection]);

  // Fetch balance when wallet connects
  useEffect(() => {
    if (wallet?.publicKey) {
      fetchBalance();
    } else {
      setBalance(null);
    }
  }, [wallet?.publicKey, fetchBalance]);

  // Auto-fill stake account address when created
  useEffect(() => {
    if (createStakeAccount.createdStakeAccount) {
      setStakeAccountAddress(createStakeAccount.createdStakeAccount.toString());
    }
  }, [createStakeAccount.createdStakeAccount]);

  const handleCreateStakeAccount = async () => {
    if (!amount || !wallet.publicKey) return;

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) return;

    const createdAddress = await createStakeAccount.createStakeAccount(amountValue);

    if (createdAddress) {
      setAmount('');
      fetchBalance();
    }
  };

  const handleDepositStakeAccount = async () => {
    if (!wallet.publicKey || !stakeAccountAddress) return;

    try {
      const stakeAccountPubkey = new PublicKey(stakeAccountAddress);

      let success = false;
      if (stakeMethod === StakeMethod.ASSISTED_STAKE_DEPOSIT) {
        success = await assistedStakeDeposit.depositStakeAccount(stakeAccountPubkey);
      } else if (stakeMethod === StakeMethod.MANUAL_STAKE_DEPOSIT) {
        success = await manualStakeDeposit.depositStakeAccount(stakeAccountPubkey);
      }

      if (success) {
        setStakeAccountAddress('');
        fetchBalance();
      }
    } catch (error) {
      console.error('Error depositing stake account:', error);
    }
  };

  const handleSolDeposit = async () => {
    if (!amount || !wallet.publicKey) return;

    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) return;

    let success = false;
    try {
      if (stakeMethod === StakeMethod.ASSISTED_SOL_DEPOSIT) {
        success = await assistedSolDeposit.depositSol(amountValue);
      } else if (stakeMethod === StakeMethod.MANUAL_SOL_DEPOSIT) {
        success = await manualSolDeposit.depositSol(amountValue);
      }

      if (success) {
        setAmount('');
        fetchBalance();
      }
    } catch (error) {
      console.error('Error in SOL deposit:', error);
    }
  };

  const isStakeDepositMethod =
    stakeMethod === StakeMethod.ASSISTED_STAKE_DEPOSIT ||
    stakeMethod === StakeMethod.MANUAL_STAKE_DEPOSIT;

  return (
    <div className="w-full mx-auto p-2 sm:p-6 bg-white">
      <h2 className="text-2xl font-bold mb-6 text-black">Stake SOL to JitoSOL</h2>

      {!wallet.publicKey ? (
        <div className="flex flex-col items-center justify-center py-6">
          <p className="mb-4 text-gray-600">Connect your wallet to get started</p>
          <WalletMultiButton />
        </div>
      ) : (
        <>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stake Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`py-2 px-3 rounded-md text-sm ${
                  stakeMethod === StakeMethod.ASSISTED_SOL_DEPOSIT
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
                onClick={() => setStakeMethod(StakeMethod.ASSISTED_SOL_DEPOSIT)}
              >
                SOL Deposit (Assisted)
              </button>
              <button
                type="button"
                className={`py-2 px-3 rounded-md text-sm ${
                  stakeMethod === StakeMethod.MANUAL_SOL_DEPOSIT
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
                onClick={() => setStakeMethod(StakeMethod.MANUAL_SOL_DEPOSIT)}
              >
                SOL Deposit (Manual)
              </button>
              <button
                type="button"
                className={`py-2 px-3 rounded-md text-sm ${
                  stakeMethod === StakeMethod.ASSISTED_STAKE_DEPOSIT
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
                onClick={() => setStakeMethod(StakeMethod.ASSISTED_STAKE_DEPOSIT)}
              >
                Stake Deposit (Assisted)
              </button>
              <button
                type="button"
                className={`py-2 px-3 rounded-md text-sm ${
                  stakeMethod === StakeMethod.MANUAL_STAKE_DEPOSIT
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
                onClick={() => setStakeMethod(StakeMethod.MANUAL_STAKE_DEPOSIT)}
              >
                Stake Deposit (Manual)
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {stakeMethod === StakeMethod.ASSISTED_SOL_DEPOSIT &&
                'Deposits SOL directly using the SPL stake pool library.'}
              {stakeMethod === StakeMethod.MANUAL_SOL_DEPOSIT &&
                'Deposits SOL directly by manually constructing the transaction.'}
              {stakeMethod === StakeMethod.ASSISTED_STAKE_DEPOSIT &&
                'Deposits a stake account using the interceptor library (2 steps).'}
              {stakeMethod === StakeMethod.MANUAL_STAKE_DEPOSIT &&
                'Deposits a stake account by manually constructing the transaction (2 steps).'}
            </p>
          </div>

          {!isStakeDepositMethod ? (
            <>
              {/* SOL Deposit Flow */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                    Amount to Deposit
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

              <Button
                type="button"
                label="Deposit SOL"
                width="full"
                onClick={handleSolDeposit}
                loading={assistedSolDeposit.isLoading || manualSolDeposit.isLoading}
                disabled={
                  !amount ||
                  parseFloat(amount) <= 0 ||
                  assistedSolDeposit.isLoading ||
                  manualSolDeposit.isLoading
                }
              />
            </>
          ) : (
            <>
              {/* Stake Deposit Flow - Two Steps */}
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">Two-Step Process</h3>
                <ol className="text-sm text-blue-800 list-decimal list-inside space-y-1">
                  <li>Create and delegate a stake account</li>
                  <li>Deposit the stake account to the pool</li>
                </ol>
              </div>

              {/* Step 1: Create Stake Account */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Step 1: Create Active Stake Account</h3>
                <p className="text-sm text-gray-600 mb-4">
                  This will deposit SOL and immediately withdraw it as a stake account in one transaction.
                </p>

                <div className="mb-4">
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

                <Button
                  type="button"
                  label="Create Active Stake Account"
                  width="full"
                  onClick={handleCreateStakeAccount}
                  loading={createStakeAccount.isLoading}
                  disabled={
                    !amount ||
                    parseFloat(amount) <= 0 ||
                    createStakeAccount.isLoading
                  }
                />
              </div>

              {/* Step 2: Deposit Stake Account */}
              <div className="mb-6 pt-6 border-t border-gray-300">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Step 2: Deposit Stake Account</h3>

                <div className="mb-4">
                  <label htmlFor="stakeAccount" className="block text-sm font-medium text-gray-700 mb-2">
                    Stake Account Address
                  </label>
                  <input
                    type="text"
                    id="stakeAccount"
                    value={stakeAccountAddress}
                    onChange={(e) => setStakeAccountAddress(e.target.value)}
                    placeholder="Enter stake account address or create one above"
                    className="w-full p-2 border text-black border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    The stake account must be delegated to a validator in the pool. The validator will be detected automatically.
                  </p>
                </div>

                <Button
                  type="button"
                  label="Deposit Stake Account"
                  width="full"
                  onClick={handleDepositStakeAccount}
                  loading={assistedStakeDeposit.isLoading || manualStakeDeposit.isLoading}
                  disabled={
                    !stakeAccountAddress ||
                    assistedStakeDeposit.isLoading ||
                    manualStakeDeposit.isLoading
                  }
                />
              </div>
            </>
          )}

        </>
      )}
    </div>
  );
};

export default StakeTab;
