import {
  PublicKey,
  Signer,
  TransactionInstruction,
  AccountMeta,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TokenInstruction } from "@solana/spl-token";
import { struct, u8 } from "@solana/buffer-layout";
import { u64 } from "@solana/buffer-layout-utils";

/**
 * Helper to add signers to an instruction
 * Copied from @solana/spl-stake-pool package
 */
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

/**
 * Interface for Approve instruction data
 * Copied from @solana/spl-stake-pool package
 */
export interface ApproveInstructionData {
  instruction: TokenInstruction.Approve;
  amount: bigint;
}

/**
 * Struct for encoding Approve instruction data
 * Copied from @solana/spl-stake-pool package
 */
export const approveInstructionData = struct<ApproveInstructionData>([
  u8("instruction"),
  u64("amount"),
]);

/**
 * Construct an Approve instruction
 * Copied from @solana/spl-stake-pool package
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
