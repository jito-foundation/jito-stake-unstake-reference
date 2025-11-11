import React, { useState } from 'react';
import Head from 'next/head';
import StakeTab from '../components/StakeTab';
import UnstakeTab from '../components/UnstakeTab';
import { WidgetMode } from '../constants';
import { useStakePoolInfo } from '../hooks/useStakePoolInfo';
import StakePoolDetails from '../components/StakePoolDetails';

export default function Home() {
  const [activeTab, setActiveTab] = useState<WidgetMode>(WidgetMode.Stake);
  const { poolInfo, isLoading, error } = useStakePoolInfo();

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <Head>
        <title>JitoSOL Staking Reference</title>
        <meta name="description" content="A reference implementation for JitoSOL staking and unstaking" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">JitoSOL / Staking Reference Site</h1>
          <p className="mt-2 text-lg text-gray-600">Stake and Unstake SOL Examples</p>
        </div>

        <StakePoolDetails poolInfo={poolInfo} isLoading={isLoading} error={error} />

        <div className="bg-white shadow rounded-lg overflow-hidden mt-4">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab(WidgetMode.Stake)}
              className={`px-6 py-4 text-center flex-1 ${
                activeTab === WidgetMode.Stake
                  ? 'text-purple-600 border-b-2 border-purple-600 font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Stake
            </button>
            <button
              onClick={() => setActiveTab(WidgetMode.Unstake)}
              className={`px-6 py-4 text-center flex-1 ${
                activeTab === WidgetMode.Unstake
                  ? 'text-purple-600 border-b-2 border-purple-600 font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Unstake
            </button>
          </div>
          <div className="p-6">{activeTab === WidgetMode.Stake ? <StakeTab /> : <UnstakeTab />}</div>
        </div>

        <div className="mt-16 text-center text-sm sm:text-base">
          <p className="text-gray-500">This is a reference implementation for educational purposes.</p>
          <a
            href="https://jito.network/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-600 hover:underline"
          >
            Learn more about Jito
          </a>
        </div>
      </main>
    </div>
  );
}
