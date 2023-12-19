import * as TestWorld from '../test-world'
import { fetchMarinadeState, getValidatorRecords } from '../../src'
import { marinadeFinanceProgram } from '../../src/programs/marinade-finance-program'
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  StakeProgram,
  Transaction,
} from '@solana/web3.js'

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
  await createAndDelegateStake(TestWorld.STAKE_ACCOUNT, votePubkey)
  await createAndDelegateStake(TestWorld.STAKE_ACCOUNT_TO_WITHDRAW, votePubkey)

  // --- WAITING FOR STAKE ACCOUNT to be READY ---
  const stakeAccounts = [
    TestWorld.STAKE_ACCOUNT.publicKey,
    TestWorld.STAKE_ACCOUNT_TO_WITHDRAW.publicKey,
  ]
  const startTime = Date.now()
  console.log(
    `Waiting for stake accounts ${stakeAccounts
      .map(sa => sa.toBase58())
      .join(', ')} to be activated`
  )
  for (const stakeAccountToWait of stakeAccounts) {
    await TestWorld.waitForStakeAccountActivation({
      stakeAccount: stakeAccountToWait,
      connection: TestWorld.CONNECTION,
    })
  }
  console.log(
    `Stake account(s) ${stakeAccounts.map(sa =>
      sa.toBase58()
    )} are activated after ${(Date.now() - startTime) / 1000} s`
  )

  // --- ADDING solana-test-validator under MARINADE ---
  const marinadeProgram = marinadeFinanceProgram({
    cnx: TestWorld.CONNECTION,
    walletAddress: TestWorld.SDK_USER.publicKey,
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

async function createAndDelegateStake(
  stakeAccountKeypair: Keypair,
  votePubkey: PublicKey,
  lamports: number = 42 * LAMPORTS_PER_SOL
) {
  // create a stake account that will be used later in all tests
  const tx = new Transaction()
  const ixStakeAccount = StakeProgram.createAccount({
    authorized: {
      staker: TestWorld.PROVIDER.wallet.publicKey,
      withdrawer: TestWorld.PROVIDER.wallet.publicKey,
    },
    fromPubkey: TestWorld.PROVIDER.wallet.publicKey,
    lamports,
    stakePubkey: stakeAccountKeypair.publicKey,
  })
  tx.add(ixStakeAccount)
  /// delegating stake account to the vote account
  const ixDelegate = StakeProgram.delegate({
    authorizedPubkey: TestWorld.PROVIDER.wallet.publicKey,
    stakePubkey: stakeAccountKeypair.publicKey,
    votePubkey,
  })
  tx.add(ixDelegate)
  await TestWorld.PROVIDER.sendAndConfirm(tx, [stakeAccountKeypair])

  const stakeBalance = await TestWorld.CONNECTION.getBalance(
    stakeAccountKeypair.publicKey
  )
  await TestWorld.CONNECTION.getAccountInfo(stakeAccountKeypair.publicKey)
  if (!stakeBalance) {
    throw new Error(
      `Jest setup error: no balance of stake account ${stakeAccountKeypair.publicKey.toBase58()}`
    )
  }
}
