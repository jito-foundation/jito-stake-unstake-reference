import { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { useNetwork } from './NetworkProvider';

// Default styles that can be overridden by your app
require('@solana/wallet-adapter-react-ui/styles.css');

interface WalletContextProviderProps {
  children: ReactNode;
}

export const WalletContextProvider: FC<WalletContextProviderProps> = ({ children }) => {
  const { network } = useNetwork();
  
  // Determine the RPC endpoint based on the selected network
  const endpoint = useMemo(() => {
    switch (network) {
      case WalletAdapterNetwork.Mainnet:
        // Use custom RPC URL from environment variable for Mainnet if available
        return process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl(WalletAdapterNetwork.Mainnet);
      
      case WalletAdapterNetwork.Testnet:
        // Always use the standard public RPC for Testnet
        return clusterApiUrl(WalletAdapterNetwork.Testnet);
        
      default:
        // For any other networks, use the appropriate public RPC endpoint
        return clusterApiUrl(network);
    }
  }, [network]);

  // @solana/wallet-adapter-wallets includes all the adapters but supports tree shaking
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter()
    ],
    [network]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default WalletContextProvider;
