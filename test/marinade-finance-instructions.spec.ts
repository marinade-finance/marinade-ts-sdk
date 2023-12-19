import {
  MarinadeUtils,
  addLiquidity,
  claim,
  deposit,
  depositStakeAccount,
  liquidUnstake,
  liquidateStakeAccount,
  orderUnstake,
} from '../src'
import * as TestWorld from './test-world'
import assert from 'assert'
import { AnchorProvider, Wallet } from '@coral-xyz/anchor'
import {
  DirectedStakeSdk,
  findVoteRecords,
} from '@marinade.finance/directed-stake-sdk'
import { Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { MarinadeProgram } from '../src/programs/marinade-program'
import { getDelayedUnstakeTickets } from '../src/programs/marinade-finance-program'

describe('Marinade Finance', () => {
  beforeAll(async () => {
    const marinadeProgram = await MarinadeProgram.init({
      cnx: TestWorld.PROVIDER.connection,
      walletAddress: TestWorld.PROVIDER.wallet.publicKey,
    })

    try {
      const { transaction: liqTx } = await addLiquidity(
        marinadeProgram,
        TestWorld.SDK_USER.publicKey,
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
      const marinadeProgram = await MarinadeProgram.init({
        cnx: TestWorld.PROVIDER.connection,
        walletAddress: TestWorld.PROVIDER.wallet.publicKey,
      })

      const { transaction } = await deposit(
        marinadeProgram,
        TestWorld.SDK_USER.publicKey,
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
      const newAccount = new Keypair()
      await TestWorld.transferMinimumLamportsBalance(newAccount.publicKey)

      const provider = new AnchorProvider(
        TestWorld.CONNECTION,
        new Wallet(newAccount),
        { commitment: 'confirmed' }
      )

      const anotherAccount = Keypair.generate()
      const marinadeProgram = await MarinadeProgram.init({
        cnx: TestWorld.PROVIDER.connection,
        walletAddress: TestWorld.PROVIDER.wallet.publicKey,
      })

      const { transaction: tx1 } = await deposit(
        marinadeProgram,
        newAccount.publicKey,
        MarinadeUtils.solToLamports(1),
        { mintToOwnerAddress: anotherAccount.publicKey }
      )
      assert.strictEqual(tx1.instructions.length, 2)
      const transactionSignature1 = await provider.sendAndConfirm(tx1)
      console.log('Deposit tx1:', transactionSignature1)

      const { transaction: tx2 } = await deposit(
        marinadeProgram,
        newAccount.publicKey,
        MarinadeUtils.solToLamports(1),
        { mintToOwnerAddress: anotherAccount.publicKey }
      )
      assert.strictEqual(tx2.instructions.length, 1)
      const transactionSignature2 = await provider.sendAndConfirm(tx2)
      console.log('Deposit tx2:', transactionSignature2)
    })

    it('deposits SOL and get mSOL to another account', async () => {
      const marinadeProgram = await MarinadeProgram.init({
        cnx: TestWorld.PROVIDER.connection,
        walletAddress: TestWorld.PROVIDER.wallet.publicKey,
      })

      const anotherAccount = Keypair.generate()
      const { transaction } = await deposit(
        marinadeProgram,
        TestWorld.SDK_USER.publicKey,
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
      const marinadeProgram = await MarinadeProgram.init({
        cnx: TestWorld.PROVIDER.connection,
        walletAddress: TestWorld.PROVIDER.wallet.publicKey,
      })

      const directedStakeSdk = new DirectedStakeSdk({
        connection: TestWorld.CONNECTION,
        wallet: {
          signTransaction: async () => new Promise(() => new Transaction()),
          signAllTransactions: async () =>
            new Promise(() => [new Transaction()]),
          publicKey: TestWorld.SDK_USER.publicKey,
        },
      })

      const { transaction } = await deposit(
        marinadeProgram,
        TestWorld.SDK_USER.publicKey,
        MarinadeUtils.solToLamports(0.01),
        { directToValidatorVoteAddress: validatorVoteAddress }
      )
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

      expect(voteRecord.account.validatorVote).toEqual(validatorVoteAddress)
    })

    it('deposit SOL and redirect the stake', async () => {
      const validatorVoteAddress2 =
        await TestWorld.getSolanaTestValidatorVoteAccountPubkey()
      const marinadeProgram = await MarinadeProgram.init({
        cnx: TestWorld.PROVIDER.connection,
        walletAddress: TestWorld.PROVIDER.wallet.publicKey,
      })

      const directedStakeSdk = new DirectedStakeSdk({
        connection: TestWorld.CONNECTION,
        wallet: {
          signTransaction: async () => new Promise(() => new Transaction()),
          signAllTransactions: async () =>
            new Promise(() => [new Transaction()]),
          publicKey: TestWorld.SDK_USER.publicKey,
        },
      })

      const { transaction } = await deposit(
        marinadeProgram,
        TestWorld.SDK_USER.publicKey,
        MarinadeUtils.solToLamports(0.01),
        { directToValidatorVoteAddress: validatorVoteAddress2 }
      )
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

      expect(voteRecord?.account.validatorVote).toEqual(validatorVoteAddress2)
    })

    it('deposit SOL and un-direct the stake', async () => {
      const marinadeProgram = await MarinadeProgram.init({
        cnx: TestWorld.PROVIDER.connection,
        walletAddress: TestWorld.PROVIDER.wallet.publicKey,
      })

      const directedStakeSdk = new DirectedStakeSdk({
        connection: TestWorld.CONNECTION,
        wallet: {
          signTransaction: async () => new Promise(() => new Transaction()),
          signAllTransactions: async () =>
            new Promise(() => [new Transaction()]),
          publicKey: TestWorld.SDK_USER.publicKey,
        },
      })

      const { transaction } = await deposit(
        marinadeProgram,
        TestWorld.SDK_USER.publicKey,
        MarinadeUtils.solToLamports(0.01)
      )
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
      const marinadeProgram = await MarinadeProgram.init({
        cnx: TestWorld.PROVIDER.connection,
        walletAddress: TestWorld.PROVIDER.wallet.publicKey,
      })

      const { transaction } = await liquidUnstake(
        marinadeProgram,
        TestWorld.SDK_USER.publicKey,
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
      const marinadeProgram = await MarinadeProgram.init({
        cnx: TestWorld.PROVIDER.connection,
        walletAddress: TestWorld.PROVIDER.wallet.publicKey,
      })

      // for a validator could be deposited, it must be activated for at least 2 epochs
      // i.e., "error: Deposited stake <pubkey> is not activated yet. Wait for #2 epoch"
      await TestWorld.waitForStakeAccountActivation({
        stakeAccount: TestWorld.STAKE_ACCOUNT.publicKey,
        connection: TestWorld.CONNECTION,
        activatedAtLeastFor: 2,
      })

      const { transaction } = await depositStakeAccount(
        marinadeProgram,
        TestWorld.SDK_USER.publicKey,
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
      const marinadeProgram = await MarinadeProgram.init({
        cnx: TestWorld.PROVIDER.connection,
        walletAddress: TestWorld.PROVIDER.wallet.publicKey,
      })

      // for a validator could be liquidated, it must be activated for at least 2 epochs
      await TestWorld.waitForStakeAccountActivation({
        stakeAccount: TestWorld.STAKE_ACCOUNT.publicKey,
        connection: TestWorld.CONNECTION,
        activatedAtLeastFor: 2,
      })

      const { transaction } = await liquidateStakeAccount(
        marinadeProgram,
        TestWorld.SDK_USER.publicKey,
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
    let ticketAccount: PublicKey | undefined

    it('order unstake', async () => {
      const marinadeProgram = await MarinadeProgram.init({
        cnx: TestWorld.PROVIDER.connection,
        walletAddress: TestWorld.PROVIDER.wallet.publicKey,
      })

      const { transaction, ticketAccountKeypair } = await orderUnstake(
        marinadeProgram,
        TestWorld.SDK_USER.publicKey,
        MarinadeUtils.solToLamports(0.1)
      )
      ticketAccount = ticketAccountKeypair.publicKey
      const transactionSignature = await TestWorld.PROVIDER.sendAndConfirm(
        transaction,
        [ticketAccountKeypair]
      )
      console.log('Order unstake tx:', transactionSignature)

      const tickets = await getDelayedUnstakeTickets(
        marinadeProgram.program,
        TestWorld.SDK_USER.publicKey
      )
      const ticketKeys: PublicKey[] = []
      for (const [key] of tickets) {
        ticketKeys.push(key)
      }
      expect(
        ticketKeys.filter(v => v.equals(ticketAccountKeypair.publicKey))
      ).toHaveLength(1)
    })

    it('try to claim tickets after expiration', async () => {
      const marinadeProgram = await MarinadeProgram.init({
        cnx: TestWorld.PROVIDER.connection,
        walletAddress: TestWorld.PROVIDER.wallet.publicKey,
      })
      const tickets = await getDelayedUnstakeTickets(
        marinadeProgram.program,
        TestWorld.SDK_USER.publicKey
      )
      for (const [key, value] of tickets) {
        if (value.ticketDue) {
          const { transaction } = await claim(
            marinadeProgram,
            TestWorld.SDK_USER.publicKey,
            key
          )
          await TestWorld.PROVIDER.sendAndConfirm(transaction)
        }
      }
    })

    it('claim', async () => {
      assert(ticketAccount !== undefined)

      const marinadeProgram = await MarinadeProgram.init({
        cnx: TestWorld.PROVIDER.connection,
        walletAddress: TestWorld.PROVIDER.wallet.publicKey,
      })

      const { transaction } = await claim(
        marinadeProgram,
        TestWorld.SDK_USER.publicKey,
        ticketAccount
      )
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
