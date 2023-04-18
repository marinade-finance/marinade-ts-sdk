import { BN } from '@coral-xyz/anchor'
import { MarinadeState } from '../marinade-state/marinade-state'

/**
 * Compute a linear fee base on liquidity amount.
 * fee(0) = max fee -> fee(x >= target) = min fee
 *
 * @param {number} lpMinFeeBasisPoints
 * @param {number} lpMaxFeeBasisPoints
 * @param {BN} lpLiquidityTarget
 * @param {BN} lamportsAvailable
 * @param {BN} lamportsToObtain
 */
export function unstakeNowFeeBp(
  lpMinFeeBasisPoints: number,
  lpMaxFeeBasisPoints: number,
  lpLiquidityTarget: BN,
  lamportsAvailable: BN,
  lamportsToObtain: BN
): number {
  // if trying to get more than existing
  if (lamportsToObtain.gte(lamportsAvailable)) {
    return lpMaxFeeBasisPoints
  }
  // result after operation
  const lamportsAfter = lamportsAvailable.sub(lamportsToObtain)
  // if GTE target => min fee
  if (lamportsAfter.gte(lpLiquidityTarget)) {
    return lpMinFeeBasisPoints
  } else {
    const delta = lpMaxFeeBasisPoints - lpMinFeeBasisPoints
    return (
      lpMaxFeeBasisPoints -
      proportionalBN(new BN(delta), lamportsAfter, lpLiquidityTarget).toNumber()
    )
  }
}

/**
 * Returns `amount` * `numerator` / `denominator`.
 * BN library proves to not be as accurate as desired.
 * BN was kept to minimize the change. To be replaced entirely by BigNumber.
 * String is the safest way to convert between them
 *
 * @param {BN} amount
 * @param {BN} numerator
 * @param {BN} denominator
 */
export function proportionalBN(amount: BN, numerator: BN, denominator: BN): BN {
  if (denominator.isZero()) {
    return amount
  }
  const result =
    (BigInt(amount.toString()) * BigInt(numerator.toString())) /
    BigInt(denominator.toString())
  return new BN(result.toString())
}

/**
 * Returns amount of mSol that would result in a stake operation
 *
 * @param {BN} solAmount
 * @param {MarinadeState} marinadeState
 */
export function computeMsolAmount(
  solAmount: BN,
  marinadeState: MarinadeState
): BN {
  const total_cooling_down =
    marinadeState.state.stakeSystem.delayedUnstakeCoolingDown.add(
      marinadeState.state.emergencyCoolingDown
    )
  const total_lamports_under_control =
    marinadeState.state.validatorSystem.totalActiveBalance
      .add(total_cooling_down)
      .add(marinadeState.state.availableReserveBalance)
  const total_virtual_staked_lamports = total_lamports_under_control.sub(
    marinadeState.state.circulatingTicketBalance
  )

  return proportionalBN(
    solAmount,
    marinadeState.state.msolSupply,
    total_virtual_staked_lamports
  )
}
