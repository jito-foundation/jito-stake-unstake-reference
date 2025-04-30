import { PublicKey } from '@solana/web3.js';

// Jito Stake Pool Address
export const JITO_STAKE_POOL_ADDRESS = new PublicKey('Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb');

// Jito SOL Mint Address String
export const JITOSOL_MINT_ADDRESS_STRING = 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn';

// Jito SOL Mint Address
export const JITO_MINT_ADDRESS = new PublicKey(JITOSOL_MINT_ADDRESS_STRING);

// Stake Pool Program ID
export const STAKE_POOL_PROGRAM_ID = new PublicKey('SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy');

// Token Program ID
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

// Wrapped SOL Token Mint
export const WRAPPED_SOL_TOKEN_MINT_STRING = 'So11111111111111111111111111111111111111112';
export const WRAPPED_SOL_TOKEN_MINT = new PublicKey(WRAPPED_SOL_TOKEN_MINT_STRING);


// Constants for calculations
export const LAMPORTS_PER_SOL = 1_000_000_000;
export const DELAYED_UNSTAKE_FEE = 0.003; // 0.3%

// Enums
export enum WidgetMode {
  Stake = 0,
  Unstake = 1,
}

export enum StakeMethod {
  ASSISTED = 'ASSISTED',
  MANUAL = 'MANUAL',
}

export const COMPUTE_UNIT_LIMIT_FOR_STAKE_OPERATIONS = 200_000;