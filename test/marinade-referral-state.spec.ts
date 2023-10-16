import { PublicKey } from '@solana/web3.js'
import {
  fetchReferralGlobalState,
  fetchReferralState,
  getReferralPartners,
} from '../src'
import {
  MarinadeReferralGlobalState,
  MarinadeReferralReferralState,
} from '../src/marinade-referral-state/marinade-referral-state.types'
import * as TestWorld from './test-world'
import BN from 'bn.js'
import { marinadeReferralProgram } from '../src/programs/marinade-referral-program'

describe('Marinade Referral Program', () => {
  describe('getReferralGlobalState', () => {
    it("fetches the referral program's global state which matches the expected type", async () => {
      const referralProgram = marinadeReferralProgram({
        provider: TestWorld.PROVIDER,
      })
      const globalState = await fetchReferralGlobalState(referralProgram)

      expect(globalState).toStrictEqual<MarinadeReferralGlobalState>({
        address: expect.any(PublicKey),
        programId: expect.any(PublicKey),
        adminAccount: expect.any(PublicKey),
        msolMintAccount: expect.any(PublicKey),
        foreman1: expect.any(PublicKey),
        foreman2: expect.any(PublicKey),
        minKeepPct: expect.any(Number),
        maxKeepPct: expect.any(Number),
      })
    })
  })

  describe('getReferralPartnerState', () => {
    it("fetches the referral partner' state which matches the expected type", async () => {
      const referralProgram = marinadeReferralProgram({
        provider: TestWorld.PROVIDER,
      })
      const partnerState = await fetchReferralState(
        referralProgram,
        TestWorld.REFERRAL_CODE
      )

      expect(partnerState).toStrictEqual<MarinadeReferralReferralState>({
        address: expect.any(PublicKey),
        programId: expect.any(PublicKey),
        baseFee: expect.any(Number),
        validatorVoteKey: null,
        keepSelfStakePct: expect.any(Number),
        delayedUnstakeAmount: expect.any(BN),
        delayedUnstakeOperations: expect.any(BN),
        depositSolAmount: expect.any(BN),
        depositSolOperations: expect.any(BN),
        depositStakeAccountAmount: expect.any(BN),
        depositStakeAccountOperations: expect.any(BN),
        liqUnstakeSolAmount: expect.any(BN),
        liqUnstakeMsolAmount: expect.any(BN),
        liqUnstakeMsolFees: expect.any(BN),
        liqUnstakeOperations: expect.any(BN),
        maxFee: expect.any(Number),
        maxNetStake: expect.any(BN),
        partnerAccount: expect.any(PublicKey),
        partnerName: TestWorld.PARTNER_NAME,
        pause: expect.any(Boolean),
        msolTokenPartnerAccount: expect.any(PublicKey),
        operationDepositSolFee: expect.any(Number),
        operationDepositStakeAccountFee: expect.any(Number),
        operationLiquidUnstakeFee: expect.any(Number),
        operationDelayedUnstakeFee: expect.any(Number),
        accumDepositSolFee: expect.any(BN),
        accumDepositStakeAccountFee: expect.any(BN),
        accumLiquidUnstakeFee: expect.any(BN),
        accumDelayedUnstakeFee: expect.any(BN),
      })
    })
  })

  describe('getReferralPartners', () => {
    it('fetches all the referral partners ', async () => {
      const referralProgram = marinadeReferralProgram({
        provider: TestWorld.PROVIDER,
      })

      const partners = await getReferralPartners(referralProgram)

      expect(partners.length).toBeGreaterThan(0)
    })
  })
})
