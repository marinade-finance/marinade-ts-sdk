import { BN } from '@project-serum/anchor'

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
 * BN library we use does not handle fractions, so the value is `floored`
 *
 * @param {BN} amount
 * @param {BN} numerator
 * @param {BN} denominator
 */
export function proportionalBN(amount: BN, numerator: BN, denominator: BN): BN {
  if (denominator.isZero()) {
    return amount
  }
  return amount.mul(numerator).div(denominator)
}
