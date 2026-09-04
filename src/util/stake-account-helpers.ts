import { web3 } from '@coral-xyz/anchor'
import { ParsedStakeAccountInfo } from './anchor.types'

// the stake program freezes meta.rent_exempt_reserve of every new account at this pre-SIMD-0437 value
const FROZEN_RENT_EXEMPT_RESERVE = 2_282_880

// deposit_stake_account compares the balance against meta.rent_exempt_reserve, which the stake program keeps writing at the pre-SIMD-0437 rent
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

  // the caller re-delegates a cooled down account before these instructions, which restakes everything above the live rent
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

// the stake account does not exist yet, so its frozen reserve can only come from the constant
export function newStakeAccountBalanceAlignmentInstructions(
  stakeAccountAddress: web3.PublicKey,
  ownerAddress: web3.PublicKey,
  nonDelegatedLamports: number
): web3.TransactionInstruction[] {
  const balanceDelta = FROZEN_RENT_EXEMPT_RESERVE - nonDelegatedLamports
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
