import { Marinade, MarinadeConfig, MarinadeUtils, Wallet, web3 } from '../src'
import * as TestWorld from './test-world'
import assert from 'assert'
import { AnchorProvider } from '@coral-xyz/anchor'

const MINIMUM_LAMPORTS_BEFORE_TEST = MarinadeUtils.solToLamports(2.5)

describe('Marinade Finance', () => {
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
      })
      const marinade = new Marinade(config)

      const { transaction } = await marinade.deposit(
        MarinadeUtils.solToLamports(1)
      )
      const transactionSignature = await TestWorld.PROVIDER.sendAndConfirm(
        transaction
      )
      console.log(
        'Deposit tx:',
        transactionSignature,
        transaction.instructions.length
      )
    })

    it('deposits SOL, only creates ATA when necessary', async () => {
      const newAccount = new web3.Keypair()
      await TestWorld.provideMinimumLamportsBalance(
        newAccount.publicKey,
        MarinadeUtils.solToLamports(2.5)
      )

      const provider = new AnchorProvider(
        TestWorld.CONNECTION,
        new Wallet(newAccount),
        { commitment: 'finalized' }
      )

      const anotherAccount = web3.Keypair.generate()
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
        publicKey: newAccount.publicKey,
      })
      const marinade = new Marinade(config)

      const { transaction: tx1 } = await marinade.deposit(
        MarinadeUtils.solToLamports(1),
        { mintToOwnerAddress: anotherAccount.publicKey }
      )
      assert.strictEqual(tx1.instructions.length, 2)
      const transactionSignature1 = await provider.sendAndConfirm(tx1)
      console.log('Deposit tx1:', transactionSignature1)

      const { transaction: tx2 } = await marinade.deposit(
        MarinadeUtils.solToLamports(1),
        { mintToOwnerAddress: anotherAccount.publicKey }
      )
      assert.strictEqual(tx2.instructions.length, 1)
      const transactionSignature2 = await provider.sendAndConfirm(tx2)
      console.log('Deposit tx2:', transactionSignature2)
    })

    it('deposits SOL and get mSOL to another account', async () => {
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
        publicKey: TestWorld.SDK_USER.publicKey,
      })
      const marinade = new Marinade(config)

      const anotherAccount = web3.Keypair.generate()
      const { transaction } = await marinade.deposit(
        MarinadeUtils.solToLamports(1),
        { mintToOwnerAddress: anotherAccount.publicKey }
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

  describe('depositStakeAccount', () => {
    it('deposits stake account (simulate)', async () => {
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
        publicKey: TestWorld.SDK_USER.publicKey,
      })
      const marinade = new Marinade(config)

      // Make sure stake account still exist, if this test is included
      const { transaction } = await marinade.depositStakeAccount(
        new web3.PublicKey('AtL1WfGDuyB2NvnqvuMuwJu4QwtiLyAhoczH5ESy7kNZ')
      )

      const { executedSlot, simulatedSlot, err, logs, unitsConsumed } =
        await TestWorld.simulateTransaction(transaction)

      expect(err).toBeNull() // no error at simulation
      expect(simulatedSlot).toBeGreaterThanOrEqual(executedSlot)
      expect(unitsConsumed).toBeGreaterThan(0) // something has been processed
      console.debug('Deposit stake account tx logs:', logs)
    })
  })

  describe('liquidateStakeAccount', () => {
    it('liquidates stake account (simulate)', async () => {
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
        publicKey: TestWorld.SDK_USER.publicKey,
      })
      const marinade = new Marinade(config)

      // Make sure stake account still exist, if this test is included
      const { transaction } = await marinade.liquidateStakeAccount(
        new web3.PublicKey('7Pi7ye5SaKMFp1J6W4kygmAYYhotwoRLTk67Z1kcCcv4')
      )
      const { executedSlot, simulatedSlot, err, logs, unitsConsumed } =
        await TestWorld.simulateTransaction(transaction)

      expect(err).toBeNull() // no error at simulation
      expect(simulatedSlot).toBeGreaterThanOrEqual(executedSlot)
      expect(unitsConsumed).toBeGreaterThan(0) // something has been processed
      console.log('Liquidate stake account tx logs:', logs)
    })
  })
})
