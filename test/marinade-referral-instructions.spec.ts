import { web3 } from '@project-serum/anchor'

import { Marinade, MarinadeConfig, MarinadeUtils } from '../src'
import * as TestWorld from './test-world'

const MINIMUM_LAMPORTS_BEFORE_TEST = MarinadeUtils.solToLamports(2)

describe('Marinade Referral', () => {
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

  describe.skip('liquidateStakeAccount', () => {
    it('liquidates stake account to SOL', async() => {
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
        publicKey: TestWorld.SDK_USER.publicKey,
        referralCode: TestWorld.REFERRAL_CODE,
      })
      const marinade = new Marinade(config)

      const { transaction } = await marinade.liquidateStakeAccount(new web3.PublicKey("Cp4JSgUrPVaqMkr6m4KEu5yyu1khPTHQHrMNn5wfQabp"))
      const transactionSignature = await TestWorld.PROVIDER.send(transaction)
      console.log('Liquididate stake account tx:', transactionSignature)
    })
  })
})
