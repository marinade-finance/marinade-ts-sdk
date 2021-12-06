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
        paymentMint: expect.any(web3.PublicKey),
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
        baseFee: 10,
        delayedUnstakeAmount: expect.any(BN),
        delayedUnstakeOperations: expect.any(BN),
        depositSolAmount: expect.any(BN),
        depositSolOperations: expect.any(BN),
        depositStakeAccountAmount: expect.any(BN),
        depositStakeAccountOperations: expect.any(BN),
        lastTransferTime: expect.any(BN),
        liqUnstakeAmount: expect.any(BN),
        liqUnstakeMsolFees: expect.any(BN),
        liqUnstakeOperations: expect.any(BN),
        maxFee: 100,
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
