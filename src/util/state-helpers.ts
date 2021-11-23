import { BN } from '@project-serum/anchor'

///compute a linear fee based on liquidity amount, it goes from fee(0)=max -> fee(x>=target)=min
export function unstakeNowFeeBp(lpMinFeeBasisPoints: number, lpMaxFeeBasisPoints: number, lpLiquidityTarget: BN, lamportsAvailable: BN, lamportsToObtain: BN): number {
  // if trying to get more than existing
  if (lamportsToObtain.gte(lamportsAvailable)) {
    return lpMaxFeeBasisPoints
  }
  // result after operation
  let lamportsAfter = lamportsAvailable.sub(lamportsToObtain)
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

export function proportionalBN(amount: BN, numerator: BN, denominator: BN): BN {
  if (denominator.isZero()) {
    return amount
  }
  return amount.mul(numerator).div(denominator)
}
