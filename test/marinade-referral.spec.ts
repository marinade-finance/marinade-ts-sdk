import { Marinade, MarinadeConfig, MarinadeUtils } from '../src'
import * as TestWorld from './test-world'

const MINIMUM_LAMPORTS_BEFORE_TEST = MarinadeUtils.solToLamports(2)

describe('Marinade Referral', () => {
  console.log('SDK User', TestWorld.SDK_USER.publicKey.toBase58())

  beforeAll(async () => {
    await TestWorld.provideMinimumLamportsBalance(TestWorld.SDK_USER.publicKey, MINIMUM_LAMPORTS_BEFORE_TEST)
  })

  // LJ: if we work with a keypair (meaning we have the priv key) that will be incompatible if we try to use this lib
  // from a FE project that connects with wallets.
  //
  // Can you please analyze if we can send a `@project-serum/anchor::Provider` object to `new MarinadeConfig`
  // instead of sending `anchorProviderUrl` and `USER_KEYPAIR` ?

  describe('deposit', () => {
    it('deposits SOL', async () => {
      console.log('ReferralCode:', TestWorld.REFERRAL_CODE.toBase58())

      const config = new MarinadeConfig({
        anchorProviderUrl: TestWorld.PROVIDER_URL,
        referralCode: TestWorld.REFERRAL_CODE,
        wallet: TestWorld.SDK_USER,
      })
      const marinade = new Marinade(config)

      const { transactionSignature } = await marinade.deposit(MarinadeUtils.solToLamports(1))
      console.log('Deposit tx:', transactionSignature)
    })
  })

  describe('liquidUnstake', () => {
    it('unstakes SOL', async () => {
      console.log('ReferralCode:', TestWorld.REFERRAL_CODE.toBase58())

      const config = new MarinadeConfig({
        anchorProviderUrl: TestWorld.PROVIDER_URL,
        referralCode: TestWorld.REFERRAL_CODE,
        wallet: TestWorld.SDK_USER,
      })
      const marinade = new Marinade(config)

      const { transactionSignature } = await marinade.liquidUnstake(MarinadeUtils.solToLamports(0.8))
      console.log('Liquid unstake tx:', transactionSignature)
    })
  })
})
