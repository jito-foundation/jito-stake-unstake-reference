import React, { useState, useEffect } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import Button from './Button';
import { useAssistedSolDeposit } from '../hooks/useAssistedSolDeposit';
import { useManualSolDeposit } from '../hooks/useManualSolDeposit';
import { useAssistedStakeDeposit } from '../hooks/useAssistedStakeDeposit';
import { useManualStakeDeposit } from '../hooks/useManualStakeDeposit';
import { useValidators } from '../hooks/useValidators';
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
  const [selectedValidator, setSelectedValidator] = useState<string>('');
  const wallet = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const assistedSolDeposit = useAssistedSolDeposit();
  const manualSolDeposit = useManualSolDeposit();
  const assistedStakeDeposit = useAssistedStakeDeposit();
  const manualStakeDeposit = useManualStakeDeposit();
  const { validators, isLoading: validatorsLoading } = useValidators();

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

    // Check if validator is required for stake deposit methods
    if (
      (stakeMethod === StakeMethod.ASSISTED_STAKE_DEPOSIT ||
        stakeMethod === StakeMethod.MANUAL_STAKE_DEPOSIT) &&
      !selectedValidator
    ) {
      return;
    }

    let success = false;

    try {
      if (stakeMethod === StakeMethod.ASSISTED_SOL_DEPOSIT) {
        success = await assistedSolDeposit.depositSol(amountValue);
      } else if (stakeMethod === StakeMethod.MANUAL_SOL_DEPOSIT) {
        success = await manualSolDeposit.depositSol(amountValue);
      } else if (stakeMethod === StakeMethod.ASSISTED_STAKE_DEPOSIT) {
        const validatorPubkey = new PublicKey(selectedValidator);
        success = await assistedStakeDeposit.stake(amountValue, validatorPubkey);
      } else if (stakeMethod === StakeMethod.MANUAL_STAKE_DEPOSIT) {
        const validatorPubkey = new PublicKey(selectedValidator);
        success = await manualStakeDeposit.stake(amountValue, validatorPubkey);
      }

      if (success) {
        setAmount('');
        setSelectedValidator('');
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
                'Creates a stake account and deposits it using the interceptor library.'}
              {stakeMethod === StakeMethod.MANUAL_STAKE_DEPOSIT &&
                'Creates a stake account and deposits it by manually constructing the transaction.'}
            </p>
          </div>

          {(stakeMethod === StakeMethod.ASSISTED_STAKE_DEPOSIT ||
            stakeMethod === StakeMethod.MANUAL_STAKE_DEPOSIT) && (
            <div className="mb-6">
              <label htmlFor="validator" className="block text-sm font-medium text-gray-700 mb-2">
                Select Validator
              </label>
              {validatorsLoading ? (
                <p className="text-sm text-gray-500">Loading validators...</p>
              ) : (
                <select
                  id="validator"
                  value={selectedValidator}
                  onChange={(e) => setSelectedValidator(e.target.value)}
                  className="w-full p-2 border text-black border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select a validator</option>
                  {validators.map((validator) => (
                    <option key={validator.voteAccount.toString()} value={validator.voteAccount.toString()}>
                      {validator.voteAccount.toString().slice(0, 8)}...{validator.voteAccount.toString().slice(-8)} ({(Number(validator.activeStakeLamports) / LAMPORTS_PER_SOL).toFixed(2)} SOL)
                    </option>
                  ))}
                </select>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Choose a validator to delegate your stake account to
              </p>
            </div>
          )}
          
          <Button
            type="button"
            label="Stake SOL"
            width="full"
            onClick={handleSubmit}
            loading={
              assistedSolDeposit.isLoading ||
              manualSolDeposit.isLoading ||
              assistedStakeDeposit.isLoading ||
              manualStakeDeposit.isLoading
            }
            disabled={
              !amount ||
              parseFloat(amount) <= 0 ||
              assistedSolDeposit.isLoading ||
              manualSolDeposit.isLoading ||
              assistedStakeDeposit.isLoading ||
              manualStakeDeposit.isLoading ||
              ((stakeMethod === StakeMethod.ASSISTED_STAKE_DEPOSIT ||
                stakeMethod === StakeMethod.MANUAL_STAKE_DEPOSIT) &&
                !selectedValidator)
            }
          />
          
        </>
      )}
    </div>
  );
};

export default StakeTab; 