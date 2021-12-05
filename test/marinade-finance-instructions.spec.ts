import { Marinade, MarinadeConfig, MarinadeUtils } from '../src'
import * as TestWorld from './test-world'

const MINIMUM_LAMPORTS_BEFORE_TEST = MarinadeUtils.solToLamports(1.5)

describe('Marinade Finance', () => {
  beforeAll(async() => {
    await TestWorld.provideMinimumLamportsBalance(TestWorld.SDK_USER.publicKey, MINIMUM_LAMPORTS_BEFORE_TEST)
  })

  describe('deposit', () => {
    it('deposits SOL', async() => {
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
        publicKey: TestWorld.SDK_USER.publicKey,
        referralCode: TestWorld.REFERRAL_CODE,
      })
      const marinade = new Marinade(config)

      const { transaction } = await marinade.deposit(MarinadeUtils.solToLamports(1))
      const transactionSignature = await TestWorld.PROVIDER.send(transaction)
      console.log('Deposit tx:', transactionSignature)
    })
  })

  describe('liquidUnstake', () => {
    it('unstakes SOL', async() => {
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
        publicKey: TestWorld.SDK_USER.publicKey,
        referralCode: TestWorld.REFERRAL_CODE,
      })
      const marinade = new Marinade(config)

      const { transaction } = await marinade.liquidUnstake(MarinadeUtils.solToLamports(0.8))
      const transactionSignature = await TestWorld.PROVIDER.send(transaction)
      console.log('Liquid unstake tx:', transactionSignature)
    })
  })

  // describe('depositStakeAccount', () => {
  //   it.only('deposits stake account', async () => {
  //     console.log('ReferralCode:', TestWorld.REFERRAL_CODE.toBase58())

  //     const config = new MarinadeConfig({
  //       connection: TestWorld.CONNECTION,
  //       publicKey: TestWorld.SDK_USER.publicKey,
  //       // referralCode: TestWorld.REFERRAL_CODE,
  //     })
  //     const marinade = new Marinade(config)

  //     const { transaction } = await marinade.depositStakeAccount(new web3.PublicKey('FYPHkZ3SVZscHpzaYhLHWKzfe9LcGc5WKbUdb2gTuUrV'))
  //     const transactionSignature = await TestWorld.PROVIDER.send(transaction)
  //     console.log('Deposit stake account tx:', transactionSignature)
  //   })
  // })
})
