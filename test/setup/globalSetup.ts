import * as TestWorld from '../test-world'
import { fetchMarinadeState, getValidatorRecords } from '../../src'
import { marinadeFinanceProgram } from '../../src/programs/marinade-finance-program'
import { LAMPORTS_PER_SOL, StakeProgram, Transaction } from '@solana/web3.js'

require('ts-node/register')

export default async (): Promise<void> => {
  // --- GETTING VOTE ACCOUNT of solana-test-validator ---
  // as there is only solana-test-validator, it's a single vote account in the test network
  const votePubkey = await TestWorld.getSolanaTestValidatorVoteAccountPubkey()

  // --- CREATING STAKE ACCOUNT and DELEGATE ---
  // create a stake account that will be used later in all tests
  const tx = new Transaction()
  const ixStakeAccount = StakeProgram.createAccount({
    authorized: {
      staker: TestWorld.PROVIDER.wallet.publicKey,
      withdrawer: TestWorld.PROVIDER.wallet.publicKey,
    },
    fromPubkey: TestWorld.PROVIDER.wallet.publicKey,
    lamports: 2 * LAMPORTS_PER_SOL,
    stakePubkey: TestWorld.STAKE_ACCOUNT.publicKey,
  })
  tx.add(ixStakeAccount)
  /// delegating stake account to the vote account
  const ixDelegate = StakeProgram.delegate({
    authorizedPubkey: TestWorld.PROVIDER.wallet.publicKey,
    stakePubkey: TestWorld.STAKE_ACCOUNT.publicKey,
    votePubkey,
  })
  tx.add(ixDelegate)
  await TestWorld.PROVIDER.sendAndConfirm(tx, [TestWorld.STAKE_ACCOUNT])

  const stakeBalance = await TestWorld.CONNECTION.getBalance(
    TestWorld.STAKE_ACCOUNT.publicKey
  )
  await TestWorld.CONNECTION.getAccountInfo(TestWorld.STAKE_ACCOUNT.publicKey)
  if (!stakeBalance) {
    throw new Error('Jest global setup error: no stake account balance')
  }

  // --- WAITING FOR STAKE ACCOUNT to be READY ---
  const startTime = Date.now()
  console.log(
    `Waiting for stake account ${TestWorld.STAKE_ACCOUNT.publicKey.toBase58()} to be activated`
  )
  await TestWorld.waitForStakeAccountActivation({
    stakeAccount: TestWorld.STAKE_ACCOUNT.publicKey,
    connection: TestWorld.CONNECTION,
  })
  console.log(
    `Stake account ${TestWorld.STAKE_ACCOUNT.publicKey.toBase58()} is activated after ${
      (Date.now() - startTime) / 1000
    } s`
  )

  // --- ADDING solana-test-validator under MARINADE ---
  const marinadeProgram = marinadeFinanceProgram({
    provider: TestWorld.PROVIDER,
  })
  const marinadeState = await fetchMarinadeState(marinadeProgram)
  if (
    !marinadeState.validatorSystem.managerAuthority.equals(
      TestWorld.MARINADE_STATE_ADMIN.publicKey
    )
  ) {
    throw new Error(
      'Jest global setup error: Marinade state expected to be configured with the TestWorld admin authority.'
    )
  }
  // check if the validator is part of Marinade already
  const validators = await getValidatorRecords(marinadeProgram, marinadeState)
  if (
    validators.validatorRecords.findIndex(
      v => v.validatorAccount.toBase58() === votePubkey.toBase58()
    ) === -1
  ) {
    console.log(
      `Validator vote account ${votePubkey.toBase58()} is not part of Marinade yet, adding it.`
    )
    const addIx = await TestWorld.addValidatorInstructionBuilder({
      program: marinadeProgram,
      marinadeState,
      validatorScore: 1000,
      rentPayer: TestWorld.PROVIDER.wallet.publicKey,
      validatorVote: votePubkey,
    })
    const addTx = new Transaction().add(addIx)
    await TestWorld.PROVIDER.sendAndConfirm(addTx, [
      TestWorld.MARINADE_STATE_ADMIN,
    ])
  }
}
