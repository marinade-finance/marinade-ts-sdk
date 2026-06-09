import { BN } from '@coral-xyz/anchor'
import { MarinadeConfig } from '../config/marinade-config'
import { Marinade } from '../marinade'
import { MarinadeState } from '../marinade-state/marinade-state'
import * as TestWorld from '../../test/test-world'
import {
  computeMsolAmount,
  computeMsolForDepositSol,
  computeMsolForDepositStakeAccount,
  feeCentsApply,
  proportionalBN,
  unstakeNowFeeBp,
} from './state-helpers'

// Minimal MarinadeState stub exposing only the fields the helpers read.
// total lamports under control = 900_000_000 + 100_000_000 = 1_000_000_000,
// msolSupply = 500_000_000 -> mSOL/SOL ratio = 0.5 (computeMsolAmount halves).
const stubState = (
  depositSolFeeBpCents: number,
  depositStakeAccountFeeBpCents: number
): MarinadeState =>
  ({
    state: {
      stakeSystem: { delayedUnstakeCoolingDown: new BN(0) },
      emergencyCoolingDown: new BN(0),
      validatorSystem: { totalActiveBalance: new BN('900000000') },
      availableReserveBalance: new BN('100000000'),
      circulatingTicketBalance: new BN(0),
      msolSupply: new BN('500000000'),
      depositSolFee: { bpCents: depositSolFeeBpCents },
      depositStakeAccountFee: { bpCents: depositStakeAccountFeeBpCents },
    },
  } as unknown as MarinadeState)

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

  describe('feeCentsApply', () => {
    // eslint-disable-next-line @typescript-eslint/no-extra-semi
    ;[
      // 1% of 1e9
      { amount: 1_000_000_000, bpCents: 10_000, expectedResult: 10_000_000 },
      // 0% -> no fee
      { amount: 1_000_000_000, bpCents: 0, expectedResult: 0 },
      // 100% -> whole amount
      {
        amount: 1_000_000_000,
        bpCents: 1_000_000,
        expectedResult: 1_000_000_000,
      },
      // floors: 999 * 1 / 1e6 = 0.000999 -> 0
      { amount: 999, bpCents: 1, expectedResult: 0 },
      // floors: 1_234_567 * 10_000 / 1e6 = 12_345.67 -> 12_345
      { amount: 1_234_567, bpCents: 10_000, expectedResult: 12_345 },
    ].forEach(({ amount, bpCents, expectedResult }) =>
      it(`floors amount * bpCents / 1e6 (${amount} * ${bpCents})`, () => {
        expect(feeCentsApply(new BN(amount), bpCents).toNumber()).toBe(
          expectedResult
        )
      })
    )
  })

  describe('computeMsolForDepositSol', () => {
    const gross = new BN('1000000000')

    it('takes the SOL fee before converting at the ratio', () => {
      // 1% fee -> net 990_000_000, ratio 0.5 -> 495_000_000
      expect(
        computeMsolForDepositSol(gross, stubState(10_000, 0)).toString()
      ).toBe('495000000')
    })

    it('equals computeMsolAmount when the fee is zero', () => {
      const state = stubState(0, 0)
      expect(computeMsolForDepositSol(gross, state).toString()).toBe(
        computeMsolAmount(gross, state).toString()
      )
    })

    it('reads depositSolFee, not depositStakeAccountFee', () => {
      // SOL fee 0, stake-account fee 50% -> must be ignored here
      expect(
        computeMsolForDepositSol(gross, stubState(0, 500_000)).toString()
      ).toBe('500000000')
    })
  })

  describe('computeMsolForDepositStakeAccount', () => {
    const gross = new BN('1000000000')

    it('takes the stake-account fee before converting at the ratio', () => {
      // 2% fee -> net 980_000_000, ratio 0.5 -> 490_000_000
      expect(
        computeMsolForDepositStakeAccount(
          gross,
          stubState(0, 20_000)
        ).toString()
      ).toBe('490000000')
    })

    it('equals computeMsolAmount when the fee is zero', () => {
      const state = stubState(0, 0)
      expect(computeMsolForDepositStakeAccount(gross, state).toString()).toBe(
        computeMsolAmount(gross, state).toString()
      )
    })

    it('reads depositStakeAccountFee, not depositSolFee', () => {
      // stake-account fee 0, SOL fee 50% -> must be ignored here
      expect(
        computeMsolForDepositStakeAccount(
          gross,
          stubState(500_000, 0)
        ).toString()
      ).toBe('500000000')
    })
  })
})
