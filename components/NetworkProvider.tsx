import React, { createContext, useState, useContext, ReactNode } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

interface NetworkContextType {
  network: WalletAdapterNetwork;
  setNetwork: (network: WalletAdapterNetwork) => void;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export const useNetwork = () => {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
};

interface NetworkProviderProps {
  children: ReactNode;
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({ children }) => {
  const [network, setNetwork] = useState<WalletAdapterNetwork>(WalletAdapterNetwork.Mainnet);

  return <NetworkContext.Provider value={{ network, setNetwork }}>{children}</NetworkContext.Provider>;
};

export default NetworkProvider;
