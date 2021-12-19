import { Marinade, MarinadeConfig, web3, BN } from '../src'
import { MarinadeReferralStateResponse } from '../src/marinade-referral-state/marinade-referral-state.types'
import * as TestWorld from './test-world'

describe('Marinade Referral State', () => {
  describe('getReferralPartnerState', () => {
    it('fetches the referral program\'s global state which matches the expected type', async() => {
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
        referralCode: TestWorld.REFERRAL_CODE,
      })
      const marinade = new Marinade(config)

      const { state } = await marinade.getReferralGlobalState()

      expect(state).toStrictEqual<MarinadeReferralStateResponse.GlobalState>({
        adminAccount: expect.any(web3.PublicKey),
        treasuryMsolAccount: expect.any(web3.PublicKey),
        treasuryMsolAuthBump: expect.any(Number),
      })
    })
  })

  describe('getReferralPartnerState', () => {
    it('fetches the referral partner\' state which matches the expected type', async() => {
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
        referralCode: TestWorld.REFERRAL_CODE,
      })
      const marinade = new Marinade(config)

      const { state } = await marinade.getReferralPartnerState()

      expect(state).toStrictEqual<MarinadeReferralStateResponse.ReferralState>({
        baseFee: expect.any(Number),
        delayedUnstakeAmount: expect.any(BN),
        delayedUnstakeOperations: expect.any(BN),
        depositSolAmount: expect.any(BN),
        depositSolOperations: expect.any(BN),
        depositStakeAccountAmount: expect.any(BN),
        depositStakeAccountOperations: expect.any(BN),
        lastTransferTime: expect.any(BN),
        liqUnstakeSolAmount: expect.any(BN),
        liqUnstakeMsolAmount: expect.any(BN),
        liqUnstakeMsolFees: expect.any(BN),
        liqUnstakeOperations: expect.any(BN),
        maxFee: expect.any(Number),
        maxNetStake: expect.any(BN),
        partnerAccount: expect.any(web3.PublicKey),
        partnerName: TestWorld.PARTNER_NAME,
        pause: expect.any(Boolean),
        tokenPartnerAccount: expect.any(web3.PublicKey),
        transferDuration: expect.any(Number),
      })
    })
  })
})
