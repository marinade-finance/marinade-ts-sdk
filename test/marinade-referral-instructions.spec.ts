import { Marinade, MarinadeConfig, MarinadeUtils } from '../src'
import * as TestWorld from './test-world'

describe('Marinade Referral', () => {
  // adding MSOL liquidity as setup of all tests
  beforeAll(async () => {
    const config = new MarinadeConfig({
      connection: TestWorld.CONNECTION,
      publicKey: TestWorld.SDK_USER.publicKey,
    })
    const marinade = new Marinade(config)
    const { transaction: liqTx } = await marinade.addLiquidity(
      MarinadeUtils.solToLamports(100)
    )
    await TestWorld.PROVIDER.sendAndConfirm(liqTx)
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
        transaction,
        [],
        { commitment: 'confirmed' }
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

      await TestWorld.waitForStakeAccountActivation({
        connection: TestWorld.CONNECTION,
        stakeAccount: TestWorld.STAKE_ACCOUNT.publicKey,
        activatedAtLeastFor: 2,
      })
      const { transaction } = await marinade.liquidateStakeAccount(
        TestWorld.STAKE_ACCOUNT.publicKey
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
