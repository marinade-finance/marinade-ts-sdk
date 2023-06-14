import { BN } from '@coral-xyz/anchor'
import { MarinadeConfig } from '../config/marinade-config'
import { Marinade } from '../marinade'
import * as TestWorld from '../../test/test-world'
import {
  computeMsolAmount,
  proportionalBN,
  unstakeNowFeeBp,
} from './state-helpers'

describe('state-helpers', () => {
  describe('unstakeNowFeeBp', () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;[
      // 0.3 % -> 3 %, obtaining more than available
      {
        lpMinFeeBasisPoints: 30,
        lpMaxFeeBasisPoints: 300,
        lpLiquidityTarget: 100,
        lamportsAvailable: 50,
        lamportsToObtain: 60,
        expectedResult: 300,
      },
      // 0.3 % -> 3 %, obtaining such amount that available lamports remain greater than liquidity target
      {
        lpMinFeeBasisPoints: 30,
        lpMaxFeeBasisPoints: 300,
        lpLiquidityTarget: 100,
        lamportsAvailable: 150,
        lamportsToObtain: 20,
        expectedResult: 30,
      },
      // 0.3 % -> 3 %, obtaining such amount that available lamports are less than liquidity target
      {
        lpMinFeeBasisPoints: 30,
        lpMaxFeeBasisPoints: 300,
        lpLiquidityTarget: 100,
        lamportsAvailable: 150,
        lamportsToObtain: 70,
        expectedResult: 84,
      },
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

        const actualResult = unstakeNowFeeBp(
          lpMinFeeBasisPoints,
          lpMaxFeeBasisPoints,
          new BN(lpLiquidityTarget),
          new BN(lamportsAvailable),
          new BN(lamportsToObtain)
        )

        expect(actualResult).toBe(expectedResult)
      })
    )
  })

  describe('proportionalBN', () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;[
      { amount: 10, numerator: 1, denominator: 2, expectedResult: 5 },
      { amount: 10, numerator: 2, denominator: 3, expectedResult: 6 },
      { amount: 10, numerator: 1, denominator: 0, expectedResult: 10 },
      {
        amount: 10230883291,
        numerator: 6978646921208343,
        denominator: 7428453065883502,
        expectedResult: 9611384974,
      },
    ].forEach(({ amount, numerator, denominator, expectedResult }) =>
      it(`calculates the proportional amount (${amount} * ${numerator} / ${denominator} ~ ${expectedResult})`, () => {
        const actualResult = proportionalBN(
          new BN(amount),
          new BN(numerator),
          new BN(denominator)
        ).toNumber()

        expect(actualResult).toBe(expectedResult)
      })
    )
  })

  describe('computeMsolAmount', () => {
    it('apply napkin math', async () => {
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION_DEVNET,
        publicKey: TestWorld.SDK_USER.publicKey,
      })
      const marinade = new Marinade(config)
      const marinadeState = await marinade.getMarinadeState()
      marinadeState.state.stakeSystem.delayedUnstakeCoolingDown = new BN(0)
      marinadeState.state.emergencyCoolingDown = new BN(0)
      marinadeState.state.validatorSystem.totalActiveBalance = new BN(
        7127287605604809
      )
      marinadeState.state.availableReserveBalance = new BN(314928893290695)
      marinadeState.state.circulatingTicketBalance = new BN(14301681747495)
      marinadeState.state.msolSupply = new BN(6978141264398309)

      const actualResult = computeMsolAmount(
        new BN('10230883291'),
        marinadeState
      )

      expect(actualResult.toString()).toBe('9611384974')
    })
  })
})
