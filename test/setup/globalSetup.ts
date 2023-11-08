import { web3 } from '@coral-xyz/anchor'
import * as TestWorld from '../test-world'
import { Marinade, MarinadeConfig } from '../../src'

require('ts-node/register')

export default async (): Promise<void> => {
  // --- GETTING VOTE ACCOUNT of solana-test-validator ---
  // as there is only solana-test-validator, it's a single vote account in the test network
  const votePubkey = await TestWorld.getSolanaTestValidatorVoteAccountPubkey()

  // --- CREATING STAKE ACCOUNT and DELEGATE ---
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
  const config = new MarinadeConfig({
    connection: TestWorld.CONNECTION,
    publicKey: TestWorld.SDK_USER.publicKey,
  })
  const marinade = new Marinade(config)
  const marinadeState = await marinade.getMarinadeState()
  if (
    !marinadeState.state.validatorSystem.managerAuthority.equals(
      TestWorld.MARINADE_STATE_ADMIN.publicKey
    )
  ) {
    throw new Error(
      'Jest global setup error: Marinade state expected to be configured with the TestWorld admin authority.'
    )
  }
  // check if the validator is part of Marinade already
  const validators = await marinadeState.getValidatorRecords()
  if (
    validators.validatorRecords.findIndex(
      v => v.validatorAccount.toBase58() === votePubkey.toBase58()
    ) === -1
  ) {
    console.log(
      `Validator vote account ${votePubkey.toBase58()} is not part of Marinade yet, adding it.`
    )
    const addIx = await TestWorld.addValidatorInstructionBuilder({
      marinade,
      validatorScore: 1000,
      rentPayer: TestWorld.PROVIDER.wallet.publicKey,
      validatorVote: votePubkey,
    })
    const addTx = new web3.Transaction().add(addIx)
    await TestWorld.PROVIDER.sendAndConfirm(addTx, [
      TestWorld.MARINADE_STATE_ADMIN,
    ])
  }
}

async function createAndDelegateStake(
  stakeAccountKeypair: web3.Keypair,
  votePubkey: web3.PublicKey,
  lamports: number = 42 * web3.LAMPORTS_PER_SOL
) {
  // create a stake account that will be used later in all tests
  const tx = new web3.Transaction()
  const ixStakeAccount = web3.StakeProgram.createAccount({
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
  const ixDelegate = web3.StakeProgram.delegate({
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
