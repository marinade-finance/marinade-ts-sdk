import { Marinade, MarinadeConfig, web3, BN } from "../src"
import { MarinadeReferralStateResponse } from "../src/marinade-referral-state/marinade-referral-state.types"
import * as TestWorld from "./test-world"

describe("Marinade Referral Program", () => {
  describe("getReferralGlobalState", () => {
    it("fetches the referral program's global state which matches the expected type", async() => {
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
        referralCode: TestWorld.REFERRAL_CODE,
      })
      const marinade = new Marinade(config)

      const { state } = await marinade.getReferralGlobalState()

      expect(state).toStrictEqual<MarinadeReferralStateResponse.GlobalState>({
        adminAccount: expect.any(web3.PublicKey),
        msolMintAccount: expect.any(web3.PublicKey),
        foreman1: expect.any(web3.PublicKey),
        foreman2: expect.any(web3.PublicKey),
        minKeepPct: expect.any(Number),
        maxKeepPct: expect.any(Number),
      })
    })
  })

  describe("getReferralPartnerState", () => {
    it("fetches the referral partner' state which matches the expected type", async() => {
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
        referralCode: TestWorld.REFERRAL_CODE,
      })
      const marinade = new Marinade(config)

      const { state } = await marinade.getReferralPartnerState()

      expect(state).toStrictEqual<MarinadeReferralStateResponse.ReferralState>({
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
        partnerAccount: expect.any(web3.PublicKey),
        partnerName: TestWorld.PARTNER_NAME,
        pause: expect.any(Boolean),
        msolTokenPartnerAccount: expect.any(web3.PublicKey),
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

  describe("getReferralPartnerState", () => {
    it("fetches the referral partner' state using argument and no config and which matches the expected type", async() => {
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
      })
      const marinade = new Marinade(config)

      const { state } = await marinade.getReferralPartnerState(
        TestWorld.REFERRAL_CODE
      )

      expect(state).toStrictEqual<MarinadeReferralStateResponse.ReferralState>({
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
        partnerAccount: expect.any(web3.PublicKey),
        partnerName: TestWorld.PARTNER_NAME,
        pause: expect.any(Boolean),
        msolTokenPartnerAccount: expect.any(web3.PublicKey),
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

  describe("getReferralPartners", () => {
    it("fetches all the referral partners ", async() => {
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
      })
      const marinade = new Marinade(config)

      const partners = await marinade.getReferralPartners()

      expect(partners.length).toBeGreaterThan(0)
    })
  })
})
