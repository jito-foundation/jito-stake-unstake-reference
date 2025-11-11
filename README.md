# JitoSOL Stake/Unstake Reference UI

This is a reference UI implementation for staking SOL to the Jito stake pool to receive JitoSOL tokens, and unstaking JitoSOL back to SOL. It demonstrates both assisted methods (using the SPL stake-pool library) and manual methods (building transactions manually) via a Next.js interface.

## Overview

This reference implementation demonstrates how to build a user interface for interacting with the Jito stake pool, showing:

1.  **Stake SOL to receive JitoSOL** (Assisted & Manual)
    - **SOL Deposit:** Direct SOL deposit into the stake pool
    - **Stake Account Deposit:** Creating a stake account and depositing it via the stake-deposit-interceptor
2.  **Unstake JitoSOL to receive SOL** (Assisted & Manual)
    - **Assisted Unstake**
      - Initiating a **withdraw** into a stake account.
      - Via use reserve option: using the pool's **reserve** for instant SOL withdrawal (subject to iquidity and is usually blocked by our chain program in favor of stake).
      - Advanced options for specifying validator and destination stake account for delayed unstake.
    - **Manual Unstake:** Creates a new stake account for the unstaked amount.
3.  **Displaying Stake Pool Details:** Shows key metrics about the Jito stake pool.
4.  **Wallet Integration:** Connects to user wallets via Wallet Adapter.
5.  **Network Switching:** Allows users to switch between Mainnet and Testnet, inside both of which a JitoSOL pool exists.

By offering both **Assisted** (library) and **Manual** (direct) methods for staking and unstaking, it helps show the underlying instructions used to build the stake pool transactions. The idea is to help developers understand, customize, and build upon these interactions.

## Getting Started

### Prerequisites

- Node.js v18+ and npm or yarn
- A Solana wallet (e.g., Phantom, Solflare) for interacting with the UI.

### Installation

1.  Clone the repository:

    ```bash
    git clone https://github.com/jito-foundation/jito-stake-unstake-reference
    cd jito-stake-unstake-reference
    ```

2.  Install dependencies:

    ```bash
    npm install
    # or
    yarn install
    ```

    **Note:** This project uses a frozen lockfile (`.yarnrc`) to ensure deterministic, secure dependency installation and prevent unexpected package updates.

    Note: The `@jito-foundation/stake-deposit-interceptor-sdk` package is installed from npm.

3.  (Optional) Set up environment variables:
    Create a `.env.local` file in the root directory. You can configure the following:

    ```
    # Custom RPC endpoint for Solana connection
    NEXT_PUBLIC_RPC_URL=YOUR_CUSTOM_MAINNET_RPC_ENDPOINT

    # Preferred validators API endpoint for optimized unstaking
    NEXT_PUBLIC_PREFERRED_VALIDATORS_API_URL=YOUR_API_ENDPOINT
    ```

    **Environment Variables:**
    - `NEXT_PUBLIC_RPC_URL`: Custom RPC endpoint. If not set, defaults to the public RPC for the selected network.
    - `NEXT_PUBLIC_PREFERRED_VALIDATORS_API_URL`: API endpoint for fetching preferred validators during unstaking. If not set, defaults to:
      - Testnet: `https://kobe.testnet.jito.network/api/v1/preferred_withdraw_validator_list`
      - Mainnet: `https://kobe.mainnet.jito.network/api/v1/preferred_withdraw_validator_list`

4.  Run the development server:

    ```bash
    npm run dev
    # or
    yarn dev
    ```

5.  Open [http://localhost:3000](http://localhost:3000) in your browser.

## Key Components

### UI Components (`components/`)

- **`Navbar.tsx`**: Top navigation bar with network selection and wallet connection button.
- **`StakePoolDetails.tsx`**: Displays fetched details about the Jito stake pool (e.g., total staked, conversion rate, fees) with an expandable view and copy-to-clipboard for addresses.
- **`StakeTab.tsx`**: Form for staking SOL, allowing selection between Assisted and Manual methods.
- **`UnstakeTab.tsx`**: Form for unstaking JitoSOL, allowing selection between Assisted and Manual methods, including options for reserve withdrawal and advanced settings.
- **`Button.tsx`**: Reusable button component.
- **`WalletContextProvider.tsx`**: Configures the Solana Wallet Adapter, handling connection logic and network endpoints.
- **`NetworkProvider.tsx`**: Context provider to manage the selected network state (Mainnet/Testnet).

### Hooks (`hooks/`)

These hooks encapsulate the core logic for interacting with the stake pool. The `Manual` hooks are particularly useful for understanding how the underlying Solana transactions and instructions are constructed, providing a clear basis for further customization.

- **`useStakePoolInfo.ts`**: Fetches and processes data about the Jito stake pool.
- **`useAssistedSolDeposit.ts`**: Implements SOL deposit using the `@solana/spl-stake-pool` library (`depositSol`). Directly deposits SOL into the stake pool in exchange for JitoSOL.
- **`useManualSolDeposit.ts`**: Implements SOL deposit by manually constructing the `DepositSol` transaction instruction. Demonstrates the steps involved in creating the instruction, handling accounts (like the associated token account), and sending the transaction. Ideal for learning or customizing the SOL deposit process.
- **`useCreateStakeAccount.ts`**: Creates an active stake account by depositing SOL and immediately withdrawing it as a stake account in a single transaction. Manually constructs both `DepositSol` and `WithdrawStake` instructions to provide an already-active stake account for the interceptor deposit flow.
- **`useAssistedStakeDeposit.ts`**: Implements stake account deposit using the `@jito-foundation/stake-deposit-interceptor-sdk` library. Accepts an existing delegated stake account and deposits it via the interceptor wrapper program.
- **`useManualStakeDeposit.ts`**: Implements stake account deposit by manually constructing the transaction with the stake-deposit-interceptor program. Accepts an existing delegated stake account, authorizes it, and builds the `DepositStake` instruction manually. Provides full control over the deposit process.
- **`useAssistedUnstake.ts`**: Implements unstaking using the `@solana/spl-stake-pool` library (`withdrawSol` or `withdrawStake`), handling reserve and delayed options.
- **`useManualUnstake.ts`**: Implements unstaking by manually constructing the `WithdrawStake` transaction instruction, creating a new stake account for the user. Shows how to find validator stake accounts, manage temporary accounts, build the instruction manually, and handle necessary signers. Serves as a detailed example for custom unstaking flows. _Note: This hook replicates some helper functions from the SPL library for instruction creation._.
- **`useManualUnstakeFromPreferredValidator.ts`**: Implements optimized unstaking using preferred validators. Fetches a prioritized list of validators via API (configurable with `NEXT_PUBLIC_PREFERRED_VALIDATORS_API_URL`) to select validators with optimal withdrawable liquidity. Manually constructs the `WithdrawStake` instruction while intelligently selecting the best validator based on available stake and withdrawal requirements.

### Constants (`constants/index.ts`)

Defines key addresses and values:

```typescript
// Jito Stake Pool Address (Mainnet-beta)
export const JITO_STAKE_POOL_ADDRESS = new PublicKey('Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb');

// Jito SOL Mint Address (JitoSOL)
export const JITO_MINT_ADDRESS = new PublicKey('J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn');

// Stake Pool Program ID
export const STAKE_POOL_PROGRAM_ID = new PublicKey('SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy');

// Other constants like LAMPORTS_PER_SOL...
```

## Staking & Unstaking Logic

### Staking

---

#### SOL Deposit Methods

##### Assisted Method

- Uses `depositSol` from `@solana/spl-stake-pool`
- Directly deposits SOL into the stake pool

##### Manual Method

- Manually creates the `DepositSol` instruction
- Includes finding/creating the associated token account for JitoSOL
- Demonstrates low-level transaction construction

---

#### Stake Account Deposit Methods

**Important:** Stake account deposits use a **two-step process**:

**Step 1: Create Active Stake Account** (using `useCreateStakeAccount`)

- Deposits SOL to the pool and immediately withdraws it as a stake account in a single transaction
- Manually constructs both `DepositSol` and `WithdrawStake` instructions in one transaction
- The transaction mints JitoSOL and immediately burns it to receive an already-active stake account
- No validator selection needed - the pool automatically assigns a validator
- Returns the stake account address for use in Step 2

**Step 2: Deposit Stake Account to Pool**

##### Assisted Method

- Uses `depositStake` from `@jito-foundation/stake-deposit-interceptor-sdk`
- Accepts an existing delegated stake account address
- Automatically detects the validator the stake is delegated to by reading the stake account data
- Authorizes and deposits the stake account via the interceptor wrapper program
- The interceptor program manages the authorization and deposit process, creating a deposit receipt that can later be used to claim pool tokens

##### Manual Method

- Manually constructs all instructions for stake account deposit
- Accepts an existing delegated stake account address
- Automatically detects the validator the stake is delegated to by parsing the stake account data
- Authorizes the stake-deposit authority as both staker and withdrawer
- Manually builds the `DepositStake` instruction for the interceptor program
- Demonstrates the complete low-level flow including PDA derivations and account setup
- Shows how JitoSOL uniquely requires the stake-deposit-interceptor wrapper program for stake deposits

**Note:** In production use cases, users typically already have delegated stake accounts and would skip Step 1, going directly to Step 2 with their existing stake account addresses.

---

### Unstaking

#### Assisted Methods

1. **Withdraw Stake**
   - Uses `withdrawStake` from `@solana/spl-stake-pool`
   - Converts JitoSOL into a stake account owned by the user
   - Represents user's share of the underlying SOL
   - Requires stake account deactivation (takes 1 epoch) before SOL can be withdrawn
   - Avoids reserve fees but takes longer to complete

2. **Via Use Reserve** (Not recommended)
   - Uses `withdrawSol` from `@solana/spl-stake-pool`
   - Instantly swaps JitoSOL for SOL directly from the pool's liquid reserve
   - Subject to available liquidity
   - Usually blocked by the Jito pool in favor of withdrawing stake

#### Manual Methods

- **Withdraw Stake**
  - Manually creates the `WithdrawStake` instruction
  - Finds a suitable validator stake account within the pool to withdraw from
  - Creates a new stake account for the user to receive the withdrawn stake
  - Also requires deactivation before the SOL is fully liquid

## Important Considerations

1.  **Account Rent & Fees:** Transactions require SOL for network fees and potentially rent-exemption for new accounts.
2.  **Stake Deposit Interceptor:** JitoSOL requires using the stake-deposit-interceptor wrapper program (program ID: `5TAiuAh3YGDbwjEruC1ZpXTJWdNDS7Ur7VeqNNiHMmGV`) for depositing stake accounts. This program manages the authorization and deposit process, creating a deposit receipt that can later be used to claim pool tokens.
3.  **Stake Account Deposits - Two-Step Process:** This implementation uses a two-step process. Step 1 creates an active stake account by depositing SOL and immediately withdrawing it as a stake account (all in one transaction). Step 2 deposits that stake account to the pool via the interceptor. In production, users typically already have delegated stake accounts and would skip Step 1, using the deposit methods directly with their existing stake account addresses.
4.  **Stake Account Deactivation:** Funds withdrawn as stake accounts (via Assisted `useReserve=false` or Manual) are only fully liquid after the stake account deactivates (typically 1-2 epochs).
5.  **Reserve Withdrawal:** Using the reserve (`useReserve=true`) is subject to available liquidity and incurs fees defined by the stake pool.
6.  **Validator Selection:** When creating stake accounts (Step 1), the pool automatically assigns a validator during the withdraw process. When depositing (Step 2), the validator is automatically detected from the stake account data - no manual selection needed.
7.  **Testnet vs Mainnet:** Pool parameters, minimum balances, and behavior differ between networks.

## References

- [Jito Network](https://www.jito.network/)
- [Jito Stake Deposit Interceptor](https://github.com/exo-tech-xyz/stake-deposit-interceptor) - Wrapper program for depositing stake accounts to JitoSOL
- [Solana SPL Stake Pool Library](https://spl.solana.com/stake-pool)
- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter)
- [Solana Web3.js Documentation](https://solana-labs.github.io/solana-web3.js/)

## Contributing

Contributions are welcome! Please open an issue or pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
