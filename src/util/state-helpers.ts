import { BN } from '@project-serum/anchor'
import BigNumber from 'bignumber.js'

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
export function unstakeNowFeeBp(lpMinFeeBasisPoints: number, lpMaxFeeBasisPoints: number, lpLiquidityTarget: BN, lamportsAvailable: BN, lamportsToObtain: BN): number {
  // if trying to get more than existing
  if (lamportsToObtain.gte(lamportsAvailable)) {
    return lpMaxFeeBasisPoints
  }
  // result after operation
  const lamportsAfter = lamportsAvailable.sub(lamportsToObtain)
  // if GTE target => min fee
  if (lamportsAfter.gte(lpLiquidityTarget)) {
    return lpMinFeeBasisPoints
  }
  else {
    const delta = lpMaxFeeBasisPoints - lpMinFeeBasisPoints
    return lpMaxFeeBasisPoints
      - proportionalBN(new BN(delta), lamportsAfter, lpLiquidityTarget).toNumber()
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
  const result = new BigNumber(amount.toString()).multipliedBy(new BigNumber(numerator.toString())).dividedBy(new BigNumber(denominator.toString()))
  return new BN(result.decimalPlaces(0, BigNumber.ROUND_FLOOR).toString())
}
