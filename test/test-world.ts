import { AnchorProvider, BN, Wallet, web3 } from '@coral-xyz/anchor'
import { MarinadeUtils } from '../src'
import { getParsedStakeAccountInfo } from '../src/util'

export const MINIMUM_LAMPORTS_BEFORE_TEST = MarinadeUtils.solToLamports(2.5)
export const LAMPORTS_AIRDROP_CAP = MarinadeUtils.solToLamports(2)

// 6LHBDKtwo69UKxWgY15vE3QykP4uf5DzZUgBiMzhEWpf
export const STAKE_ACCOUNT: web3.Keypair = web3.Keypair.fromSecretKey(
  new Uint8Array([
    18, 172, 235, 211, 112, 44, 110, 149, 4, 64, 227, 34, 56, 159, 198, 19, 146,
    61, 87, 180, 155, 178, 178, 146, 241, 198, 208, 91, 79, 219, 120, 107, 79,
    58, 194, 166, 138, 20, 154, 53, 107, 169, 158, 49, 96, 130, 207, 101, 203,
    106, 176, 103, 94, 13, 170, 98, 66, 69, 124, 209, 44, 76, 190, 136,
  ])
)

// 9wmxMQ2TFxYh918RzESjiA1dUXbdRAsXBd12JA1vwWQq
export const SDK_USER = web3.Keypair.fromSecretKey(
  new Uint8Array([
    120, 45, 242, 38, 63, 135, 84, 226, 66, 56, 76, 216, 125, 144, 38, 182, 53,
    47, 169, 251, 128, 65, 185, 237, 41, 47, 64, 53, 158, 124, 64, 2, 132, 229,
    176, 107, 25, 190, 28, 223, 58, 136, 95, 237, 236, 176, 26, 160, 11, 12,
    131, 129, 21, 8, 221, 100, 249, 221, 177, 114, 143, 231, 102, 250,
  ])
)
// for local validator testing the SDK USER is a predefined account having enough SOL
console.log('SDK User', SDK_USER.publicKey.toBase58())

// 2APsntHoKXCeHWfxZ49ADwc5XrdB8GGmxK34jVXRYZyV
export const MARINADE_STATE_ADMIN = web3.Keypair.fromSecretKey(
  new Uint8Array([
    88, 46, 254, 11, 76, 182, 135, 63, 92, 56, 112, 173, 43, 58, 65, 74, 13, 97,
    203, 36, 231, 178, 221, 92, 234, 200, 208, 114, 32, 230, 251, 217, 17, 67,
    199, 164, 137, 164, 176, 85, 236, 29, 246, 150, 180, 35, 94, 120, 30, 17,
    18, 138, 253, 155, 218, 23, 84, 125, 225, 110, 37, 142, 253, 100,
  ])
)

// used for the base tests that cannot start the localhost provider
export const PROVIDER_URL_DEVNET = 'https://api.devnet.solana.com'
export const CONNECTION_DEVNET = new web3.Connection(PROVIDER_URL_DEVNET, {
  commitment: 'confirmed',
})

export const PROVIDER_URL = 'http://localhost:8899'
export const CONNECTION = new web3.Connection(PROVIDER_URL, {
  commitment: 'confirmed',
})
export const PROVIDER = new AnchorProvider(CONNECTION, new Wallet(SDK_USER), {
  commitment: 'confirmed' /*, skipPreflight: true*/,
})

export const REFERRAL_CODE = new web3.PublicKey(
  '2Q7u7ndBhSJpTNpDzkjvRyRvuzRLZSovkNRQ5SEUb64g'
)
export const PARTNER_NAME = 'marinade_ts_sdk'
console.log('Referral partner', PARTNER_NAME, REFERRAL_CODE.toBase58())

export async function airdrop(
  to: web3.PublicKey,
  amountLamports: number
): Promise<void> {
  const signature = await CONNECTION.requestAirdrop(to, amountLamports)
  await CONNECTION.confirmTransaction(signature)
  console.log(
    'Airdrop:',
    MarinadeUtils.lamportsToSol(new BN(amountLamports)),
    'SOL',
    'to',
    to.toBase58()
  )
}

export const getBalanceLamports = async (account: web3.PublicKey) =>
  CONNECTION.getBalance(account)

export async function airdropMinimumLamportsBalance(
  account: web3.PublicKey,
  minimumLamportsBalance: BN
): Promise<void> {
  const balanceLamports = new BN(await getBalanceLamports(account))
  if (balanceLamports.gte(minimumLamportsBalance)) {
    return
  }

  let remainingLamportsToAirdrop = minimumLamportsBalance.sub(balanceLamports)
  while (remainingLamportsToAirdrop.gtn(0)) {
    const airdropLamports = BN.min(
      LAMPORTS_AIRDROP_CAP,
      remainingLamportsToAirdrop
    )
    await airdrop(account, airdropLamports.toNumber())
    remainingLamportsToAirdrop = remainingLamportsToAirdrop.sub(airdropLamports)
  }
}

export async function transferMinimumLamportsBalance(
  address: web3.PublicKey,
  provider: AnchorProvider = PROVIDER,
  lamports: BN = MINIMUM_LAMPORTS_BEFORE_TEST
): Promise<string> {
  const ix = web3.SystemProgram.transfer({
    fromPubkey: provider.publicKey, // wallet address, will sign
    toPubkey: address,
    lamports: BigInt(lamports.toString()),
  })
  const tx = new web3.Transaction().add(ix)
  return await provider.sendAndConfirm(tx)
}

export async function simulateTransaction(transaction: web3.Transaction) {
  const {
    context: { slot: executedSlot },
    value: { blockhash },
  } = await CONNECTION.getLatestBlockhashAndContext()
  transaction.recentBlockhash = blockhash
  transaction.feePayer = SDK_USER.publicKey

  const {
    context: { slot: simulatedSlot },
    value: { err, logs, unitsConsumed, accounts, returnData },
  } = await PROVIDER.connection.simulateTransaction(transaction)
  return {
    executedSlot,
    simulatedSlot,
    err,
    logs,
    unitsConsumed,
    accounts,
    returnData,
  }
}

let solanaTestValidatorVotePubkey: web3.PublicKey | undefined
export async function getSolanaTestValidatorVoteAccountPubkey(): Promise<web3.PublicKey> {
  if (solanaTestValidatorVotePubkey === undefined) {
    const voteAccounts = await CONNECTION.getVoteAccounts()
    // expecting run on localhost and only one vote account is available, i.e., one validator solana-test-validator
    if (voteAccounts.current.length !== 1) {
      throw new Error(
        'Expected one vote account of solana-test-validator. Cannot continue in global local test setup.' +
          ` Number of vote accounts found: ${voteAccounts.current.length}`
      )
    }
    solanaTestValidatorVotePubkey = new web3.PublicKey(
      voteAccounts.current[0].votePubkey
    )
  }

  return solanaTestValidatorVotePubkey
}

// Used for local solana-test-validator testing.
// The globalSetup.ts creates stake account and before it can be used one needs to wait for its activation.
// This function waits for the stake account to be activated.
// Plus, parameter 'activatedAtLeastFor' defines how many epochs the stake account has to be activated for to be considered OK.
//       The epoch activation for at least some epochs is required by Marinade to be able to delegate.
// ---
// When cannot be activated until timeout elapses an error is thrown.
// (The timeout is considered separately for waiting for activation and for epochs).
// ---
// NOTE: the Anchor.toml configures slots_per_epoch to 32,
//       so the timeout of 30 seconds should be enough for the stake account to be activated
export async function waitForStakeAccountActivation({
  stakeAccount = STAKE_ACCOUNT.publicKey,
  connection = CONNECTION,
  timeoutSeconds = 30,
  activatedAtLeastFor = 0,
}: {
  stakeAccount?: web3.PublicKey
  connection?: web3.Connection
  timeoutSeconds?: number
  activatedAtLeastFor?: number
}) {
  // 1. waiting for the stake account to be activated
  {
    const startTime = Date.now()
    let stakeStatus = await connection.getStakeActivation(stakeAccount)
    while (stakeStatus.state !== 'active') {
      await sleep(1000)
      stakeStatus = await connection.getStakeActivation(stakeAccount)
      if (Date.now() - startTime > timeoutSeconds * 1000) {
        throw new Error(
          `Stake account ${stakeAccount.toBase58()} was not activated in timeout of ${timeoutSeconds} seconds`
        )
      }
    }
  }

  // 2. the stake account is active, but it needs to be active for at least waitForEpochs epochs
  if (activatedAtLeastFor > 0) {
    const stakeAccountData = await getParsedStakeAccountInfo(
      connection,
      stakeAccount
    )
    const stakeAccountActivationEpoch = stakeAccountData.activationEpoch
    if (stakeAccountActivationEpoch === null) {
      throw new Error(
        'Expected stake account to be already activated. Unexpected setup error stake account:' +
          stakeAccountData
      )
    }

    const startTime = Date.now()
    let currentEpoch = (await connection.getEpochInfo()).epoch
    if (
      currentEpoch <
      stakeAccountActivationEpoch.toNumber() + activatedAtLeastFor
    ) {
      console.debug(
        `Waiting for the stake account ${stakeAccount.toBase58()} to be active at least for ${activatedAtLeastFor} epochs ` +
          `currently active for ${
            currentEpoch - stakeAccountActivationEpoch.toNumber()
          } epoch(s)`
      )
    }
    while (
      currentEpoch <
      stakeAccountActivationEpoch.toNumber() + activatedAtLeastFor
    ) {
      if (Date.now() - startTime > timeoutSeconds * 1000) {
        throw new Error(
          `Stake account ${stakeAccount.toBase58()} was activated but timeout ${timeoutSeconds} elapsed when waiting ` +
            `for ${activatedAtLeastFor} epochs the account to be activated, it's activated only for ` +
            `${
              currentEpoch - stakeAccountActivationEpoch.toNumber()
            } epochs at this time`
        )
      }
      await sleep(1000)
      currentEpoch = (await connection.getEpochInfo()).epoch
    }
  }
}

export const sleep = async (ms: number) => {
  return new Promise(resolve => setTimeout(resolve, ms))
}
