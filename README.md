# JitoSOL Stake/Unstake Reference UI

This is a reference UI implementation for staking SOL to the Jito stake pool to receive JitoSOL tokens, and unstaking JitoSOL back to SOL. It demonstrates both assisted methods (using the SPL stake-pool library) and manual methods (building transactions manually) via a Next.js interface.

## Overview

This reference implementation demonstrates how to build a user interface for interacting with the Jito stake pool, showing:

1.  **Stake SOL to receive JitoSOL** (Assisted & Manual)
2.  **Unstake JitoSOL to receive SOL** (Assisted & Manual)
    *   **Assisted Unstake Options:**
        *   Using the pool's **reserve** for instant SOL withdrawal (subject to iquidity).
        *   Initiating a **withdraw** into a stake account.
        *   Advanced options for specifying validator and destination stake account for delayed unstake.
    *   **Manual Unstake:** Creates a new stake account for the unstaked amount.
3.  **Displaying Stake Pool Details:** Shows key metrics about the Jito stake pool.
4.  **Wallet Integration:** Connects to user wallets via Wallet Adapter.
5.  **Network Switching:** Allows users to switch between Mainnet and Testnet, inside both of which a JitoSOL pool exists.

By offering both **Assisted** (library) and **Manual** (direct) methods for staking and unstaking, it helps show the underlying instructions used to build the stake pool transactions. The idea is to help developers understand, customize, and build upon these interactions.

## Getting Started

### Prerequisites

*   Node.js v18+ and npm or yarn
*   A Solana wallet (e.g., Phantom, Solflare) for interacting with the UI.

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

3.  (Optional) Set up environment variables:
    Create a `.env.local` file in the root directory. You can specify a custom Mainnet RPC endpoint if needed:
    ```
    NEXT_PUBLIC_RPC_URL=YOUR_CUSTOM_MAINNET_RPC_ENDPOINT
    ```
    If not set, the default Solana public RPC for the selected network will be used.

4.  Run the development server:
    ```bash
    npm run dev
    # or
    yarn dev
    ```

5.  Open [http://localhost:3000](http://localhost:3000) in your browser.

## Key Components

### UI Components (`components/`)

*   **`Navbar.tsx`**: Top navigation bar with network selection and wallet connection button.
*   **`StakePoolDetails.tsx`**: Displays fetched details about the Jito stake pool (e.g., total staked, conversion rate, fees) with an expandable view and copy-to-clipboard for addresses.
*   **`StakeTab.tsx`**: Form for staking SOL, allowing selection between Assisted and Manual methods.
*   **`UnstakeTab.tsx`**: Form for unstaking JitoSOL, allowing selection between Assisted and Manual methods, including options for reserve withdrawal and advanced settings.
*   **`Button.tsx`**: Reusable button component.
*   **`WalletContextProvider.tsx`**: Configures the Solana Wallet Adapter, handling connection logic and network endpoints.
*   **`NetworkProvider.tsx`**: Context provider to manage the selected network state (Mainnet/Testnet).

### Hooks (`hooks/`)

These hooks encapsulate the core logic for interacting with the stake pool. The `Manual` hooks are particularly useful for understanding how the underlying Solana transactions and instructions are constructed, providing a clear basis for further customization.

*   **`useStakePoolInfo.ts`**: Fetches and processes data about the Jito stake pool.
*   **`useAssistedStake.ts`**: Implements staking using the `@solana/spl-stake-pool` library (`depositSol`).
*   **`useManualStake.ts`**: Implements staking by manually constructing the `DepositSol` transaction instruction. Demonstrates the steps involved in creating the instruction, handling accounts (like the associated token account), and sending the transaction. Ideal for learning or customizing the staking process.
*   **`useAssistedUnstake.ts`**: Implements unstaking using the `@solana/spl-stake-pool` library (`withdrawSol` or `withdrawStake`), handling reserve and delayed options.
*   **`useManualUnstake.ts`**: Implements unstaking by manually constructing the `WithdrawStake` transaction instruction, creating a new stake account for the user. Shows how to find validator stake accounts, manage temporary accounts, build the instruction manually, and handle necessary signers. Serves as a detailed example for custom unstaking flows. *Note: This hook replicates some helper functions from the SPL library for instruction creation.*.

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

*   **Assisted:** Uses `depositSol` from `@solana/spl-stake-pool`.
*   **Manual:** Manually creates the `DepositSol` instruction, including finding/creating the associated token account for JitoSOL.

### Unstaking

*   **Assisted (Use Reserve):** Uses `withdrawSol` from `@solana/spl-stake-pool` to instantly swap JitoSOL for SOL directly from the pool's liquid reserve. This is subject to available liquidity and incurs the pool's withdrawal fee.
*   **Assisted (Withdraw Stake):** Uses `withdrawStake` from `@solana/spl-stake-pool` to convert JitoSOL into a stake account owned by the user, representing their share of the underlying SOL. This stake account then needs to be deactivated (typically takes 1-2 epochs) before the SOL can be fully withdrawn. This method avoids reserve fees but takes longer.
*   **Manual (Withdraw Stake):** Manually creates the `WithdrawStake` instruction. It finds a suitable validator stake account within the pool to withdraw from and creates a *new* stake account for the user to receive the withdrawn stake. This also requires deactivation before the SOL is fully liquid.

## Important Considerations

1.  **Account Rent & Fees:** Transactions require SOL for network fees and potentially rent-exemption for new accounts.
3.  **Stake Account Deactivation:** Funds withdrawn as stake accounts (via Assisted `useReserve=false` or Manual) are only fully liquid after the stake account deactivates (typically 1-2 epochs).
4.  **Reserve Withdrawal:** Using the reserve (`useReserve=true`) is subject to available liquidity and incurs fees defined by the stake pool.
5.  **Testnet vs Mainnet:** Pool parameters, minimum balances, and behavior differ between networks.

## References

*   [Jito Network](https://www.jito.network/)
*   [Solana SPL Stake Pool Library](https://spl.solana.com/stake-pool)
*   [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter)
*   [Solana Web3.js Documentation](https://solana-labs.github.io/solana-web3.js/)

## Contributing

Contributions are welcome! Please open an issue or pull request for any improvements or bug fixes.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
