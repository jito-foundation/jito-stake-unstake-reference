import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { WalletContextProvider } from '../components/WalletContextProvider';
import { NetworkProvider, useNetwork } from '../components/NetworkProvider';
import Navbar from '../components/Navbar';
import { Toaster } from 'react-hot-toast';

function AppContent({ Component, pageProps }: AppProps) {
  const { network, setNetwork } = useNetwork();
  
  return (
    <>
      <Navbar onNetworkChange={setNetwork} currentNetwork={network} />
      <Component {...pageProps} />
    </>
  );
}

export default function App(props: AppProps) {
  return (
    <NetworkProvider>
      <WalletContextProvider>
        <AppContent {...props} />
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 5000,
            style: {
              background: '#fff',
              color: '#333',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              padding: '16px',
              borderRadius: '8px',
            },
          }}
        />
      </WalletContextProvider>
    </NetworkProvider>
  );
}
