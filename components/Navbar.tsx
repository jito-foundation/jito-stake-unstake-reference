import React from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const WalletMultiButton = dynamic(
    () =>
        import('@solana/wallet-adapter-react-ui').then(
            (mod) => mod.WalletMultiButton,
        ),
    { ssr: false },
)

interface NavbarProps {
    onNetworkChange: (network: WalletAdapterNetwork) => void;
    currentNetwork: WalletAdapterNetwork;
}

const Navbar: React.FC<NavbarProps> = ({ onNetworkChange, currentNetwork }) => {
    return (
        <nav className="bg-white shadow-lg sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex items-center">
                        <Link href="/">
                            <span className="text-xl font-bold text-gray-900 cursor-pointer">
                                Reference Guide
                            </span>
                        </Link>
                    </div>

                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <select
                                value={currentNetwork}
                                onChange={(e) => onNetworkChange(e.target.value as WalletAdapterNetwork)}
                                className="appearance-none bg-gray-100 border border-gray-300 rounded-md py-[13px] px-3 pr-8 text-gray-700 leading-tight focus:outline-none focus:bg-white focus:border-purple-500"
                            >
                                <option value={WalletAdapterNetwork.Mainnet}>Mainnet</option>
                                {/* <option value={WalletAdapterNetwork.Devnet}>Devnet</option> */}
                                <option value={WalletAdapterNetwork.Testnet}>Testnet</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                </svg>
                            </div>
                        </div>

                        <WalletMultiButton className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded transition duration-150 focus:outline-none" />
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar; 