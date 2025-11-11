import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

/**
 * Interface for the preferred validator API response
 */
export interface PreferredWithdraw {
  rank: number;
  vote_account: string;
  withdrawable_lamports: number;
  stake_account: string;
}

/**
 * Determines the API URL for fetching preferred validators based on network and environment configuration.
 * Priority:
 * 1. Uses NEXT_PUBLIC_PREFERRED_VALIDATORS_API_URL if defined (for local development)
 * 2. Falls back to network-specific Kobe API endpoints
 *
 * @param network - The current wallet adapter network
 * @returns The API URL to use for fetching preferred validators
 */
export const getPreferredValidatorsApiUrl = (network: WalletAdapterNetwork): string => {
  // Check if env var is defined (for local development)
  const envApiUrl = process.env.NEXT_PUBLIC_PREFERRED_VALIDATORS_API_URL;
  if (envApiUrl) {
    console.log('Using API URL from environment:', envApiUrl);
    return envApiUrl;
  }

  // Fallback to Kobe API based on network
  const apiPath = '/api/v1/preferred_withdraw_validator_list';
  let baseUrl: string;

  switch (network) {
    case WalletAdapterNetwork.Testnet:
      baseUrl = 'https://kobe.testnet.jito.network';
      break;
    case WalletAdapterNetwork.Mainnet:
    default:
      baseUrl = 'https://kobe.mainnet.jito.network';
      break;
  }

  const apiUrl = `${baseUrl}${apiPath}`;
  console.log(`Using ${network} API URL:`, apiUrl);
  return apiUrl;
};