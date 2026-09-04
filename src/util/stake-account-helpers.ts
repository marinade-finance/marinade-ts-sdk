import { web3 } from '@coral-xyz/anchor'
import { ParsedStakeAccountInfo } from './anchor.types'

// the stake program freezes meta.rent_exempt_reserve of every new account at this pre-SIMD-0437 value
const FROZEN_RENT_EXEMPT_RESERVE = 2_282_880

// SIMD-0437 lowered the rent while the stake program keeps writing the pre-reduction value into
// meta.rent_exempt_reserve, which is the value deposit_stake_account compares the balance against
export function stakeAccountBalanceAlignmentInstructions(
  stakeAccountInfo: ParsedStakeAccountInfo,
  ownerAddress: web3.PublicKey,
  currentEpoch: number,
  rent: number
): web3.TransactionInstruction[] {
  const {
    address,
    balanceLamports,
    stakedLamports,
    rentExemptReserveLamports,
    deactivationEpoch,
    isCoolingDown,
  } = stakeAccountInfo

  if (
    !balanceLamports ||
    !stakedLamports ||
    !rentExemptReserveLamports ||
    !deactivationEpoch
  ) {
    throw new Error(
      `Failed to read balance data of the stake account ${address.toBase58()}`
    )
  }

  // a cooled down account gets re-delegated by the caller, which restakes everything above the live rent
  const isRedelegated = isCoolingDown && deactivationEpoch.ltn(currentEpoch)
  const balanceDelta = isRedelegated
    ? rentExemptReserveLamports.subn(rent)
    : stakedLamports.add(rentExemptReserveLamports).sub(balanceLamports)

  if (balanceDelta.isZero()) {
    return []
  }

  if (balanceDelta.isNeg()) {
    return web3.StakeProgram.withdraw({
      stakePubkey: address,
      authorizedPubkey: ownerAddress,
      toPubkey: ownerAddress,
      lamports: balanceDelta.neg().toNumber(),
    }).instructions
  }

  return [
    web3.SystemProgram.transfer({
      fromPubkey: ownerAddress,
      toPubkey: address,
      lamports: balanceDelta.toNumber(),
    }),
  ]
}

// the stake account is created within the same transaction, so the reserve the split freezes
// into it is not readable anywhere yet
export function newStakeAccountBalanceAlignmentInstructions(
  instructions: web3.TransactionInstruction[],
  stakeAccountAddress: web3.PublicKey,
  ownerAddress: web3.PublicKey
): web3.TransactionInstruction[] {
  const creation = instructions.find(
    instruction =>
      instruction.programId.equals(web3.SystemProgram.programId) &&
      web3.SystemInstruction.decodeInstructionType(instruction) === 'Create' &&
      web3.SystemInstruction.decodeCreateAccount(
        instruction
      ).newAccountPubkey.equals(stakeAccountAddress)
  )
  if (!creation) {
    throw new Error(
      `Failed to find the creation of the stake account ${stakeAccountAddress.toBase58()}`
    )
  }

  const balanceDelta =
    FROZEN_RENT_EXEMPT_RESERVE -
    web3.SystemInstruction.decodeCreateAccount(creation).lamports
  if (balanceDelta <= 0) {
    return []
  }

  return [
    web3.SystemProgram.transfer({
      fromPubkey: ownerAddress,
      toPubkey: stakeAccountAddress,
      lamports: balanceDelta,
    }),
  ]
}
