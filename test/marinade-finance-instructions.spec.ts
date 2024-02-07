import { Marinade, MarinadeConfig, MarinadeUtils, Wallet, web3 } from '../src'
import * as TestWorld from './test-world'
import assert from 'assert'
import { AnchorProvider } from '@coral-xyz/anchor'
import {
  DirectedStakeSdk,
  findVoteRecords,
} from '@marinade.finance/directed-stake-sdk'

describe('Marinade Finance', () => {
  beforeAll(async () => {
    const config = new MarinadeConfig({
      connection: TestWorld.CONNECTION,
      publicKey: TestWorld.SDK_USER.publicKey,
    })
    const marinade = new Marinade(config)
    try {
      const { transaction: liqTx } = await marinade.addLiquidity(
        MarinadeUtils.solToLamports(100)
      )
      await TestWorld.PROVIDER.sendAndConfirm(liqTx)
    } catch (err) {
      console.log('Failure on beforeAll addLiquidity transaction')
      console.log(err)
      throw err
    }
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
      await TestWorld.transferMinimumLamportsBalance(newAccount.publicKey)

      const provider = new AnchorProvider(
        TestWorld.CONNECTION,
        new Wallet(newAccount),
        { commitment: 'confirmed' }
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

    it('deposit SOL and direct the stake', async () => {
      const validatorVoteAddress =
        await TestWorld.getSolanaTestValidatorVoteAccountPubkey()
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
        publicKey: TestWorld.SDK_USER.publicKey,
      })
      const marinade = new Marinade(config)

      const directedStakeSdk = new DirectedStakeSdk({
        connection: TestWorld.CONNECTION,
        wallet: {
          signTransaction: async () =>
            new Promise(() => new web3.Transaction()),
          signAllTransactions: async () =>
            new Promise(() => [new web3.Transaction()]),
          publicKey: TestWorld.SDK_USER.publicKey,
        },
      })

      const { transaction } = await marinade.deposit(
        MarinadeUtils.solToLamports(0.01)
      )

      const voteIx = await marinade.createDirectedStakeVoteIx(
        validatorVoteAddress
      )
      if (voteIx) transaction.instructions.push(voteIx)

      let transactionSignature: string
      try {
        transactionSignature = await TestWorld.PROVIDER.sendAndConfirm(
          transaction,
          [],
          { commitment: 'confirmed' }
        )
      } catch (e) {
        console.log(e)
        throw e
      }
      console.log(
        'Deposit tx:',
        transactionSignature,
        transaction.instructions.length
      )

      const voteRecord = (
        await findVoteRecords({
          sdk: directedStakeSdk,
          owner: TestWorld.SDK_USER.publicKey,
        })
      )[0]

      expect(voteRecord.account.target).toEqual(validatorVoteAddress)
    })

    it('deposit SOL and redirect the stake', async () => {
      const validatorVoteAddress2 =
        await TestWorld.getSolanaTestValidatorVoteAccountPubkey()
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
        publicKey: TestWorld.SDK_USER.publicKey,
      })
      const marinade = new Marinade(config)

      const directedStakeSdk = new DirectedStakeSdk({
        connection: TestWorld.CONNECTION,
        wallet: {
          signTransaction: async () =>
            new Promise(() => new web3.Transaction()),
          signAllTransactions: async () =>
            new Promise(() => [new web3.Transaction()]),
          publicKey: TestWorld.SDK_USER.publicKey,
        },
      })

      const { transaction } = await marinade.deposit(
        MarinadeUtils.solToLamports(0.01)
      )

      const voteIx = await marinade.createDirectedStakeVoteIx(
        validatorVoteAddress2
      )
      if (voteIx) transaction.instructions.push(voteIx)

      const transactionSignature = await TestWorld.PROVIDER.sendAndConfirm(
        transaction,
        [],
        { commitment: 'confirmed' }
      )
      console.log(
        'Deposit tx:',
        transactionSignature,
        transaction.instructions.length
      )

      const voteRecord = (
        await findVoteRecords({
          sdk: directedStakeSdk,
          owner: TestWorld.SDK_USER.publicKey,
        })
      )[0]

      expect(voteRecord?.account.target).toEqual(validatorVoteAddress2)
    })

    it('deposit SOL and undirect the stake', async () => {
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
        publicKey: TestWorld.SDK_USER.publicKey,
      })
      const marinade = new Marinade(config)

      const directedStakeSdk = new DirectedStakeSdk({
        connection: TestWorld.CONNECTION,
        wallet: {
          signTransaction: async () =>
            new Promise(() => new web3.Transaction()),
          signAllTransactions: async () =>
            new Promise(() => [new web3.Transaction()]),
          publicKey: TestWorld.SDK_USER.publicKey,
        },
      })

      const { transaction } = await marinade.deposit(
        MarinadeUtils.solToLamports(0.01)
      )

      const voteIx = await marinade.createDirectedStakeVoteIx()
      if (voteIx) transaction.instructions.push(voteIx)

      const transactionSignature = await TestWorld.PROVIDER.sendAndConfirm(
        transaction,
        [],
        { commitment: 'confirmed' }
      )
      console.log(
        'Deposit tx:',
        transactionSignature,
        transaction.instructions.length
      )

      const voteRecord = (
        await findVoteRecords({
          sdk: directedStakeSdk,
          owner: TestWorld.SDK_USER.publicKey,
        })
      )[0]

      expect(voteRecord).toBeUndefined()
    })
  })

  // expected the `deposit SOL` test to be called before
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

      // for a validator could be deposited, it must be activated for at least 2 epochs
      // i.e., "error: Deposited stake <pubkey> is not activated yet. Wait for #2 epoch"
      await TestWorld.waitForStakeAccountActivation({
        stakeAccount: TestWorld.STAKE_ACCOUNT.publicKey,
        connection: TestWorld.CONNECTION,
        activatedAtLeastFor: 2,
      })

      const { transaction } = await marinade.depositStakeAccount(
        TestWorld.STAKE_ACCOUNT.publicKey
      )

      const { executedSlot, simulatedSlot, err, logs, unitsConsumed } =
        await TestWorld.simulateTransaction(transaction)

      expect(err).toBeNull() // no error at simulation
      expect(simulatedSlot).toBeGreaterThanOrEqual(executedSlot)
      expect(unitsConsumed).toBeGreaterThan(0) // something has been processed
      console.debug('Deposit stake account tx logs:', logs)
    })
  })

  // this tests is dependent on being called after `deposits stake account (simulate)`
  describe('liquidateStakeAccount', () => {
    it('liquidates stake account (simulate)', async () => {
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
        publicKey: TestWorld.SDK_USER.publicKey,
      })
      const marinade = new Marinade(config)

      // for a validator could be liquidated, it must be activated for at least 2 epochs
      await TestWorld.waitForStakeAccountActivation({
        stakeAccount: TestWorld.STAKE_ACCOUNT.publicKey,
        connection: TestWorld.CONNECTION,
        activatedAtLeastFor: 2,
      })

      const { transaction } = await marinade.liquidateStakeAccount(
        TestWorld.STAKE_ACCOUNT.publicKey
      )
      const { executedSlot, simulatedSlot, err, logs, unitsConsumed } =
        await TestWorld.simulateTransaction(transaction)

      expect(err).toBeNull() // no error at simulation
      expect(simulatedSlot).toBeGreaterThanOrEqual(executedSlot)
      expect(unitsConsumed).toBeGreaterThan(0) // something has been processed
      console.log('Liquidate stake account tx logs:', logs)
    })
  })

  // expecting this test to be called after the `deposit SOL` is executed
  describe('order unstake and claim', () => {
    let ticketAccount: web3.PublicKey | undefined

    it('order unstake', async () => {
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
        publicKey: TestWorld.SDK_USER.publicKey,
      })
      const marinade = new Marinade(config)

      const { transaction, ticketAccountKeypair } = await marinade.orderUnstake(
        MarinadeUtils.solToLamports(0.1)
      )
      ticketAccount = ticketAccountKeypair.publicKey
      const transactionSignature = await TestWorld.PROVIDER.sendAndConfirm(
        transaction,
        [ticketAccountKeypair]
      )
      console.log('Order unstake tx:', transactionSignature)

      const tickets = await marinade.getDelayedUnstakeTickets(
        TestWorld.SDK_USER.publicKey
      )
      const ticketKeys: web3.PublicKey[] = []
      for (const [key] of tickets) {
        ticketKeys.push(key)
      }
      expect(
        ticketKeys.filter(v => v.equals(ticketAccountKeypair.publicKey))
      ).toHaveLength(1)
    })

    it('try to claim tickets after expiration', async () => {
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
        publicKey: TestWorld.SDK_USER.publicKey,
      })
      const marinade = new Marinade(config)
      const tickets = await marinade.getDelayedUnstakeTickets(
        TestWorld.SDK_USER.publicKey
      )
      for (const [key, value] of tickets) {
        if (value.ticketDue) {
          const { transaction } = await marinade.claim(key)
          await TestWorld.PROVIDER.sendAndConfirm(transaction)
        }
      }
    })

    it('claim', async () => {
      assert(ticketAccount !== undefined)

      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
        publicKey: TestWorld.SDK_USER.publicKey,
      })
      const marinade = new Marinade(config)

      const { transaction } = await marinade.claim(ticketAccount)
      try {
        // expecting error as the ticket is not expired yet
        await TestWorld.PROVIDER.sendAndConfirm(transaction)
        fail('should not be able to claim')
      } catch (e) {
        if (!(e as Error).message.includes('custom program error: 0x1784')) {
          console.log('Claim ticket failed with unexpected error', e)
          throw e
        }
      }
    })
  })
})
