import {
  MarinadeUtils,
  addLiquidity,
  deposit,
  liquidUnstake,
  liquidateStakeAccount,
} from '../src'
import { MarinadeProgram } from '../src/programs/marinade-program'
import * as TestWorld from './test-world'

describe('Marinade Referral', () => {
  // adding MSOL liquidity as setup of all tests
  beforeAll(async () => {
    const marinadeProgram = await MarinadeProgram.init({
      provider: TestWorld.PROVIDER,
    })

    const { transaction: liqTx } = await addLiquidity(
      marinadeProgram,
      TestWorld.SDK_USER.publicKey,
      MarinadeUtils.solToLamports(100)
    )
    await TestWorld.PROVIDER.sendAndConfirm(liqTx)
  })

  describe('deposit', () => {
    it('deposits SOL', async () => {
      const referralProgram = await MarinadeProgram.init({
        provider: TestWorld.PROVIDER,
        referralCode: TestWorld.REFERRAL_CODE,
      })

      const { transaction } = await deposit(
        referralProgram,
        TestWorld.SDK_USER.publicKey,
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
      const referralProgram = await MarinadeProgram.init({
        provider: TestWorld.PROVIDER,
        referralCode: TestWorld.REFERRAL_CODE,
      })

      const { transaction } = await liquidUnstake(
        referralProgram,
        TestWorld.SDK_USER.publicKey,
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
      const referralProgram = await MarinadeProgram.init({
        provider: TestWorld.PROVIDER,
        referralCode: TestWorld.REFERRAL_CODE,
      })

      await TestWorld.waitForStakeAccountActivation({
        connection: TestWorld.CONNECTION,
        stakeAccount: TestWorld.STAKE_ACCOUNT.publicKey,
        activatedAtLeastFor: 2,
      })
      const { transaction } = await liquidateStakeAccount(
        referralProgram,
        TestWorld.SDK_USER.publicKey,
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
