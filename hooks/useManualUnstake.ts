import { useMemo, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  Transaction,
  LAMPORTS_PER_SOL,
  PublicKey,
  ComputeBudgetProgram,
  StakeProgram,
  Keypair,
  SystemProgram,
  TransactionInstruction,
  SYSVAR_CLOCK_PUBKEY,
  Signer,
  AccountMeta,
} from '@solana/web3.js';
import {
  JITO_MINT_ADDRESS,
  JITO_STAKE_POOL_ADDRESS,
  STAKE_POOL_PROGRAM_ID,
} from '../constants';
import { getStakePoolAccount, ValidatorListLayout, STAKE_POOL_PROGRAM_ID as StakePoolLibProgramId } from '@solana/spl-stake-pool';
import {
  getAssociatedTokenAddressSync,
  getAccount,
  TOKEN_PROGRAM_ID,
  TokenInstruction,
} from '@solana/spl-token';
import toast from 'react-hot-toast';
import { useNetwork } from '../components/NetworkProvider';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { struct, u8 } from '@solana/buffer-layout';
import { u64 } from '@solana/buffer-layout-utils';


// Helper to add signers to an instruction -- COPIED from spl stake pool package
export function addSigners(
  keys: AccountMeta[],
  ownerOrAuthority: PublicKey,
  multiSigners: (Signer | PublicKey)[],
): AccountMeta[] {
  if (multiSigners.length) {
    keys.push({ pubkey: ownerOrAuthority, isSigner: false, isWritable: false });
    for (const signer of multiSigners) {
      keys.push({
        pubkey: signer instanceof PublicKey ? signer : signer.publicKey,
        isSigner: true,
        isWritable: false,
      });
    }
  } else {
    keys.push({ pubkey: ownerOrAuthority, isSigner: true, isWritable: false });
  }
  return keys;
}


// COPIED from spl stake pool package
export interface ApproveInstructionData {
  instruction: TokenInstruction.Approve;
  amount: bigint;
}

// COPIED from spl stake pool package
export const approveInstructionData = struct<ApproveInstructionData>([u8('instruction'), u64('amount')]);

/**
 * Construct an Approve instruction -- COPIED from spl stake pool package
 *
 * @param account      Account to set the delegate for
 * @param delegate     Account authorized to transfer tokens from the account
 * @param owner        Owner of the account
 * @param amount       Maximum number of tokens the delegate may transfer
 * @param multiSigners Signing accounts if `owner` is a multisig
 * @param programId    SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createApproveInstruction(
  account: PublicKey,
  delegate: PublicKey,
  owner: PublicKey,
  amount: number | bigint,
  multiSigners: (Signer | PublicKey)[] = [],
  programId = TOKEN_PROGRAM_ID,
): TransactionInstruction {
  const keys = addSigners(
    [
      { pubkey: account, isSigner: false, isWritable: true },
      { pubkey: delegate, isSigner: false, isWritable: false },
    ],
    owner,
    multiSigners,
  );

  const data = Buffer.alloc(approveInstructionData.span);
  approveInstructionData.encode(
    {
      instruction: TokenInstruction.Approve,
      amount: BigInt(amount),
    },
    data,
  );

  return new TransactionInstruction({ keys, programId, data });
}

// Helper to find stake account address (potentially internal to spl-stake-pool, replicating simplified version)
async function findStakeProgramAddress(programId: PublicKey, voteAddress: PublicKey, stakePoolAddress: PublicKey): Promise<PublicKey> {
  const [publicKey] = await PublicKey.findProgramAddress(
    [voteAddress.toBuffer(), stakePoolAddress.toBuffer()],
    programId,
  );
  return publicKey;
}


/**
 * Hook for manually unstaking JitoSOL into a stake account.
 */
export const useManualUnstake = () => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const { network } = useNetwork();

  useMemo(() => {
  }, [connection]);

  /**
   * Manually creates and sends a transaction to unstake JitoSOL into a stake account.
   * @param amount - Amount of JitoSOL to unstake (in JitoSOL, not lamports)
   */
  const unstake = async (
    amount: number,
  ): Promise<boolean> => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      toast.error('Wallet not connected');
      return false;
    }

    setIsLoading(true);
    setTxSignature(null);

    const loadingToastId = toast.loading(`Preparing unstake transaction...`);

    try {
      console.log(`Manually unstaking ${amount} JitoSOL`);

      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
      if (lamports <= 0) {
        throw new Error('Invalid amount specified');
      }

      const stakePoolAccount = await getStakePoolAccount(connection as any, JITO_STAKE_POOL_ADDRESS);
      if (!stakePoolAccount) {
        throw new Error('Failed to get stake pool account data');
      }

      const [withdrawAuthority] = PublicKey.findProgramAddressSync(
        [JITO_STAKE_POOL_ADDRESS.toBuffer(), Buffer.from('withdraw')],
        STAKE_POOL_PROGRAM_ID
      );

      const userPoolTokenAccount = getAssociatedTokenAddressSync(JITO_MINT_ADDRESS, wallet.publicKey);
      const poolTokenAccountInfo = await getAccount(connection, userPoolTokenAccount).catch(() => null);
      if (!poolTokenAccountInfo) {
        throw new Error('Could not find JitoSOL token account');
      }
      if (poolTokenAccountInfo.amount < BigInt(lamports)) {
        throw new Error(`Insufficient JitoSOL balance. You have ${Number(poolTokenAccountInfo.amount) / LAMPORTS_PER_SOL} JitoSOL but trying to unstake ${amount} JitoSOL`);
      }

      const transaction = new Transaction();
      const signers: Keypair[] = [];

      const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 });
      transaction.add(computeBudgetIx);

      const transferAuthority = Keypair.generate();
      signers.push(transferAuthority);

      transaction.add(
        createApproveInstruction(
          userPoolTokenAccount,
          transferAuthority.publicKey,
          wallet.publicKey,
          lamports
        )
      );

      // --- Logic for withdrawing as stake account --- 
      toast.loading(`Finding suitable validator...`, { id: loadingToastId });

      // Find a suitable validator stake account to withdraw FROM
      const validatorListAccountInfo = await connection.getAccountInfo(stakePoolAccount.account.data.validatorList);
      if (!validatorListAccountInfo) {
        throw new Error('Failed to fetch validator list');
      }
      const validatorListData = ValidatorListLayout.decode(validatorListAccountInfo.data);

      // Find an active validator with enough balance
      let suitableValidatorStakeAddress: PublicKey | null = null;
      let activeValidatorVoteAddress: PublicKey | null = null;

      const minimumRequiredLamports_Mainnet = 3282880;
      const minimumRequiredLamports_Testnet = 1002282880; // Value for testnet min
      const minimumRequiredLamports = network === WalletAdapterNetwork.Testnet
        ? minimumRequiredLamports_Testnet
        : minimumRequiredLamports_Mainnet;

      console.log(`Using minimumRequiredLamports for ${network}: ${minimumRequiredLamports}`);

      for (const validatorInfo of validatorListData.validators) {
        if (validatorInfo.status !== 0) { // Skip inactive validators
          continue;
        }

        const voteAddress = validatorInfo.voteAccountAddress;

        try {
          const derivedStakeAddress = await findStakeProgramAddress(
            StakePoolLibProgramId,
            voteAddress,
            JITO_STAKE_POOL_ADDRESS
          );

          const sourceStakeAccInfo = await connection.getAccountInfo(derivedStakeAddress);
          if (!sourceStakeAccInfo) {
            continue;
          }
          if (!sourceStakeAccInfo.owner.equals(StakeProgram.programId)) {
            continue;
          }

          const estimatedNeededStakeLamports = Math.floor(lamports * 2); // Add 100% buffer
          const availableLamports = sourceStakeAccInfo.lamports - minimumRequiredLamports;

          console.log(`   -> Available lamports: ${availableLamports}`);
          console.log(`   -> Estimated needed stake lamports: ${estimatedNeededStakeLamports}`);
          // Check if the account has enough lamports ABOVE the minimum required
          if (availableLamports > estimatedNeededStakeLamports) {
            console.log(`   -> Suitable validator found! Using stake account ${derivedStakeAddress.toBase58()}`);
            suitableValidatorStakeAddress = derivedStakeAddress;
            activeValidatorVoteAddress = voteAddress;
            break; // Found a suitable validator, exit the loop
          } else {
          }
        } catch (e) {
          console.warn(` - Error checking validator ${voteAddress.toBase58()}:`, e);
          continue;
        }
      }

      if (!suitableValidatorStakeAddress || !activeValidatorVoteAddress) {
        throw new Error('Could not find any active validator stake account with sufficient balance to withdraw from.');
      }

      const validatorStakeAccountAddress = suitableValidatorStakeAddress; // Use the found address
      console.log(`Using derived validator stake account: ${validatorStakeAccountAddress.toBase58()}`);

      // Create temporary stake account to receive funds
      const tempStakeAccount = Keypair.generate();
      signers.push(tempStakeAccount);
      const stakeRentExempt = await connection.getMinimumBalanceForRentExemption(StakeProgram.space);

      // 1. Create temporary stake account
      transaction.add(
        SystemProgram.createAccount({
          fromPubkey: wallet.publicKey,
          newAccountPubkey: tempStakeAccount.publicKey,
          lamports: stakeRentExempt,
          space: StakeProgram.space,
          programId: StakeProgram.programId,
        })
      );

      // 2. Withdraw Stake instruction (destination is the temporary account)
      const withdrawStakeInstruction = new TransactionInstruction({
        programId: STAKE_POOL_PROGRAM_ID,
        keys: [
          { pubkey: JITO_STAKE_POOL_ADDRESS, isSigner: false, isWritable: true },
          { pubkey: stakePoolAccount.account.data.validatorList, isSigner: false, isWritable: true },
          { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
          { pubkey: validatorStakeAccountAddress, isSigner: false, isWritable: true }, // Source Validator Stake
          { pubkey: tempStakeAccount.publicKey, isSigner: false, isWritable: true }, // Destination Stake (temp)
          { pubkey: wallet.publicKey!, isSigner: true, isWritable: false }, // Destination Authority (user)
          { pubkey: transferAuthority.publicKey, isSigner: true, isWritable: false }, // Approver
          { pubkey: userPoolTokenAccount, isSigner: false, isWritable: true },
          { pubkey: stakePoolAccount.account.data.managerFeeAccount, isSigner: false, isWritable: true },
          { pubkey: stakePoolAccount.account.data.poolMint, isSigner: false, isWritable: true },
          { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: StakeProgram.programId, isSigner: false, isWritable: false },
        ],
        data: (() => {
          // Create a buffer for the instruction data
          const dataLayout = Buffer.alloc(9); // 1 byte for instruction index + 8 bytes for lamports
          dataLayout.writeUInt8(10, 0); // Instruction index 10 for withdraw stake
          dataLayout.writeBigInt64LE(BigInt(lamports), 1); // Write lamports as a 64-bit integer
          return dataLayout;
        })()
      });
      transaction.add(withdrawStakeInstruction);

      // --- End of withdraw as stake logic ---

      // Transaction finalization
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;

      if (signers.length > 0) {
        transaction.partialSign(...signers);
      }

      toast.loading(`Awaiting wallet signature...`, { id: loadingToastId });
      const signedTransaction = await wallet.signTransaction(transaction);

      toast.loading(`Sending transaction...`, { id: loadingToastId });
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      setTxSignature(signature);

      toast.loading(`Confirming transaction... ${signature.substring(0, 8)}`, { id: loadingToastId });
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

      console.log('Manual unstake transaction successful:', signature);
      toast.dismiss(loadingToastId);

      // Main confirmation toast with link
      toast.success(
        `Transaction Confirmed! View: <br />https://solscan.io/tx/${signature}${network === WalletAdapterNetwork.Testnet ? '?cluster=testnet' : ''}`,
        {
          duration: 8000,
          style: {
            overflowWrap: 'break-word',
            wordBreak: 'break-word',
          },
        }
      );

      return true;
    } catch (err: any) {
      console.error('Error in manual unstake:', err);
      const message = err.message || 'Unstaking failed. Please try again.';
      toast.dismiss(loadingToastId);
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    unstake,
    isLoading,
    txSignature,
  };
};
