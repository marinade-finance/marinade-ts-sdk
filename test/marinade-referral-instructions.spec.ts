import { web3 } from '@coral-xyz/anchor'

import { Marinade, MarinadeConfig, MarinadeUtils } from '../src'
import * as TestWorld from './test-world'

const MINIMUM_LAMPORTS_BEFORE_TEST = MarinadeUtils.solToLamports(2)

describe('Marinade Referral', () => {
  beforeAll(async () => {
    await TestWorld.provideMinimumLamportsBalance(
      TestWorld.SDK_USER.publicKey,
      MINIMUM_LAMPORTS_BEFORE_TEST
    )
  })

  describe('deposit', () => {
    it('deposits SOL', async () => {
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
        publicKey: TestWorld.SDK_USER.publicKey,
        referralCode: TestWorld.REFERRAL_CODE,
      })
      const marinade = new Marinade(config)

      const { transaction } = await marinade.deposit(
        MarinadeUtils.solToLamports(1)
      )
      const transactionSignature = await TestWorld.PROVIDER.sendAndConfirm(
        transaction
      )
      console.log('Deposit tx:', transactionSignature)
    })
  })

  describe('liquidUnstake', () => {
    it('unstakes SOL', async () => {
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
        publicKey: TestWorld.SDK_USER.publicKey,
        referralCode: TestWorld.REFERRAL_CODE,
      })
      const marinade = new Marinade(config)

      const { transaction } = await marinade.liquidUnstake(
        MarinadeUtils.solToLamports(0.8)
      )
      const transactionSignature = await TestWorld.PROVIDER.sendAndConfirm(
        transaction
      )
      console.log('Liquid unstake tx:', transactionSignature)
    })
  })

  describe('liquidateStakeAccount', () => {
    it('liquidates stake account (simulation)', async () => {
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
        publicKey: TestWorld.SDK_USER.publicKey,
      })
      const marinade = new Marinade(config)

      // Make sure stake account still exist, if this test is included
      const { transaction } = await marinade.liquidateStakeAccount(
        new web3.PublicKey('FPFQJ7SNx2ZgpJ4nSuqzAhpofDdKMxN9sT8FDXpxGxng')
      )

      const { executedSlot, simulatedSlot, err, logs, unitsConsumed } =
        await TestWorld.simulateTransaction(transaction)

      expect(err).toBeNull() // no error at simulation
      expect(simulatedSlot).toBeGreaterThanOrEqual(executedSlot)
      expect(unitsConsumed).toBeGreaterThan(0) // some actions were processed
      console.debug('Liquidate stake account tx log:', logs)
    })
  })
})
