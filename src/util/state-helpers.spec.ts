import { BN } from '@project-serum/anchor'
import { proportionalBN, unstakeNowFeeBp } from './state-helpers'

describe('state-helpers', () => {
  describe('unstakeNowFeeBp', () => {
    [
      // 0.3 % -> 3 %, obtaining more than available
      { lpMinFeeBasisPoints: 30, lpMaxFeeBasisPoints: 300, lpLiquidityTarget: 100, lamportsAvailable: 50, lamportsToObtain: 60, expectedResult: 300 },
      // 0.3 % -> 3 %, obtaining such amount that available lamports remain greater than liquidity target
      { lpMinFeeBasisPoints: 30, lpMaxFeeBasisPoints: 300, lpLiquidityTarget: 100, lamportsAvailable: 150, lamportsToObtain: 20, expectedResult: 30 },
      // 0.3 % -> 3 %, obtaining such amount that available lamports are less than liquidity target
      { lpMinFeeBasisPoints: 30, lpMaxFeeBasisPoints: 300, lpLiquidityTarget: 100, lamportsAvailable: 150, lamportsToObtain: 70, expectedResult: 84 },
    ].forEach((args, testNo) =>
      it(`calculates the fee correctly (#${testNo})`, () => {
        const {
          lpMinFeeBasisPoints,
          lpMaxFeeBasisPoints,
          lpLiquidityTarget,
          lamportsAvailable,
          lamportsToObtain,
          expectedResult,
        } = args

        const actualResult = unstakeNowFeeBp(lpMinFeeBasisPoints, lpMaxFeeBasisPoints, new BN(lpLiquidityTarget), new BN(lamportsAvailable), new BN(lamportsToObtain))

        expect(actualResult).toBe(expectedResult)
      })
    )
  })

  describe('proportionalBN', () => {
    [
      { amount: 10, numerator: 1, denominator: 2, expectedResult: 5 },
      { amount: 10, numerator: 2, denominator: 3, expectedResult: 6 },
      { amount: 10, numerator: 1, denominator: 0, expectedResult: 10 },
    ].forEach(({ amount, numerator, denominator, expectedResult}) =>
      it(`calculates the proportional amount (${amount} * ${numerator} / ${denominator} ~ ${expectedResult})`, () => {
        const actualResult = proportionalBN(new BN(amount), new BN(numerator), new BN(denominator)).toNumber()

        expect(actualResult).toBe(expectedResult)
      })
    )
  })
})
