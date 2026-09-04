import { BN, web3 } from '@coral-xyz/anchor'
import { getStakePoolAccount } from '@solana/spl-stake-pool'
import { Marinade, MarinadeConfig, MarinadeState } from '../../src'
import { ValidatorStats } from '../../src/marinade.types'
import { getParsedStakeAccountInfo } from '../../src/util'
import { ParsedStakeAccountInfo } from '../../src/util/anchor.types'

const SURFPOOL_URL = process.env.SURFPOOL_URL ?? 'http://127.0.0.1:8899'
const MAINNET_URL =
  process.env.MAINNET_URL ?? 'https://api.mainnet-beta.solana.com'

const STAKED_LAMPORTS = new BN(5).mul(new BN(web3.LAMPORTS_PER_SOL))
const STAKE_POOL_ADDRESS = new web3.PublicKey(
  process.env.STAKE_POOL ?? 'Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb'
)
const POOL_TOKENS_TO_DEPOSIT = 10
const WRONG_STAKE_BALANCE = 6048

const OFFSET_RENT_EXEMPT_RESERVE = 4
const OFFSET_STAKER = 12
const OFFSET_WITHDRAWER = 44
const OFFSET_VOTER = 124
const OFFSET_STAKE = 156
const OFFSET_DEACTIVATION_EPOCH = 172

async function surfnetRpc(method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(SURFPOOL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const body = await response.json()
  if (body.error) {
    throw new Error(`${method} failed: ${JSON.stringify(body.error)}`)
  }
  return body.result
}

async function setAccount(
  address: web3.PublicKey,
  fields: Record<string, unknown>
): Promise<void> {
  await surfnetRpc('surfnet_setAccount', [address.toBase58(), fields])
}

// what the SDK did before the SIMD-0437 fix: withdraw everything above delegation.stake + the live rent
function preFixAlignmentInstructions(
  stakeAccountInfo: ParsedStakeAccountInfo,
  ownerAddress: web3.PublicKey,
  rent: number
): web3.TransactionInstruction[] {
  const lamportsToWithdraw =
    stakeAccountInfo
      .balanceLamports!.sub(stakeAccountInfo.stakedLamports!)
      .toNumber() - rent
  if (lamportsToWithdraw <= 0) {
    return []
  }
  return web3.StakeProgram.withdraw({
    stakePubkey: stakeAccountInfo.address,
    authorizedPubkey: ownerAddress,
    toPubkey: ownerAddress,
    lamports: lamportsToWithdraw,
  }).instructions
}

function logsOfInterest(logs: string[] | null): string {
  return (logs ?? [])
    .filter(
      log =>
        log.includes('Error') || log.includes('Left') || log.includes('Right')
    )
    .join('\n')
}

function assertWrongStakeBalance(
  err: web3.SimulatedTransactionResponse['err'],
  logs: string[] | null
): void {
  const custom = (
    err as { InstructionError?: [number, { Custom?: number }] } | null
  )?.InstructionError?.[1]?.Custom
  if (custom !== WRONG_STAKE_BALANCE) {
    throw new Error(
      `Expected the pre-fix instructions to fail with WrongStakeBalance (${WRONG_STAKE_BALANCE}), got ${JSON.stringify(
        err
      )}`
    )
  }
  console.log('pre-fix simulation failed as expected:')
  console.log(logsOfInterest(logs))
}

async function assertPreFixFails(
  connection: web3.Connection,
  user: web3.Keypair,
  stakeAccountInfo: ParsedStakeAccountInfo,
  transaction: web3.Transaction,
  stakeAccountAddress: web3.PublicKey,
  rent: number
): Promise<void> {
  const preFixTransaction = new web3.Transaction().add(
    ...preFixAlignmentInstructions(stakeAccountInfo, user.publicKey, rent),
    ...transaction.instructions.filter(
      instruction => !isTopUp(instruction, stakeAccountAddress)
    )
  )
  const preFix = await connection.simulateTransaction(preFixTransaction, [user])
  assertWrongStakeBalance(preFix.value.err, preFix.value.logs)
}

async function assertDepositedUnderMarinade(
  connection: web3.Connection,
  marinadeState: MarinadeState,
  user: web3.PublicKey,
  stakeAccountAddress: web3.PublicKey
): Promise<void> {
  const deposited = await getParsedStakeAccountInfo(
    connection,
    stakeAccountAddress
  )
  const stakeWithdrawAuthority = await marinadeState.stakeWithdrawAuthority()
  if (!deposited.authorizedWithdrawerAddress!.equals(stakeWithdrawAuthority)) {
    throw new Error(
      `Stake account withdrawer is ${deposited.authorizedWithdrawerAddress}, expected ${stakeWithdrawAuthority}`
    )
  }
  console.log(
    `stake account under Marinade withdraw authority, user mSOL: ${await mSolBalance(
      connection,
      marinadeState,
      user
    )}`
  )
}

function isTopUp(
  instruction: web3.TransactionInstruction,
  stakeAccountAddress: web3.PublicKey
): boolean {
  return (
    instruction.programId.equals(web3.SystemProgram.programId) &&
    web3.SystemInstruction.decodeInstructionType(instruction) === 'Transfer' &&
    web3.SystemInstruction.decodeTransfer(instruction).toPubkey.equals(
      stakeAccountAddress
    )
  )
}

async function alignForkRentWithMainnet(
  connection: web3.Connection,
  mainnet: web3.Connection
): Promise<number> {
  const rentSysvar = await mainnet.getAccountInfo(web3.SYSVAR_RENT_PUBKEY)
  if (!rentSysvar) {
    throw new Error('Failed to read the mainnet rent sysvar')
  }
  await setAccount(web3.SYSVAR_RENT_PUBKEY, {
    data: toHex(Uint8Array.from(rentSysvar.data)),
  })
  return connection.getMinimumBalanceForRentExemption(web3.StakeProgram.space)
}

function toHex(data: Uint8Array): string {
  return Array.from(data, byte => byte.toString(16).padStart(2, '0')).join('')
}

async function synthesizeStakeAccount(
  template: Uint8Array,
  balanceLamports: BN,
  voteAccount: web3.PublicKey,
  user: web3.PublicKey,
  deactivationEpoch?: number
): Promise<web3.PublicKey> {
  const data = Uint8Array.from(template)
  data.set(user.toBytes(), OFFSET_STAKER)
  data.set(user.toBytes(), OFFSET_WITHDRAWER)
  data.set(voteAccount.toBytes(), OFFSET_VOTER)
  const view = new DataView(data.buffer)
  view.setBigUint64(OFFSET_STAKE, BigInt(STAKED_LAMPORTS.toString()), true)
  if (deactivationEpoch !== undefined) {
    view.setBigUint64(
      OFFSET_DEACTIVATION_EPOCH,
      BigInt(deactivationEpoch),
      true
    )
  }

  const address = web3.Keypair.generate().publicKey
  await setAccount(address, {
    lamports: balanceLamports.toNumber(),
    owner: web3.StakeProgram.programId.toBase58(),
    data: toHex(data),
    executable: false,
  })
  return address
}

async function mSolBalance(
  connection: web3.Connection,
  marinadeState: MarinadeState,
  user: web3.PublicKey
): Promise<string> {
  const accounts = await connection.getTokenAccountsByOwner(user, {
    mint: marinadeState.mSolMintAddress,
  })
  const balance = await connection.getTokenAccountBalance(
    accounts.value[0].pubkey
  )
  return balance.value.uiAmountString ?? '0'
}

async function stakePoolTokenCase(
  connection: web3.Connection,
  marinade: Marinade,
  marinadeState: MarinadeState,
  user: web3.Keypair,
  frozenReserve: BN,
  name: string,
  build: (
    validators: ValidatorStats[]
  ) => Promise<{ transaction: web3.VersionedTransaction }>
): Promise<void> {
  console.log(`\n=== ${name} ===`)
  const { account: stakePool } = await getStakePoolAccount(
    connection,
    STAKE_POOL_ADDRESS
  )
  await surfnetRpc('surfnet_setTokenAccount', [
    user.publicKey.toBase58(),
    stakePool.data.poolMint.toBase58(),
    { amount: 10 * POOL_TOKENS_TO_DEPOSIT * web3.LAMPORTS_PER_SOL },
  ])

  const { validatorRecords } = await marinadeState.getValidatorRecords()
  const validators = validatorRecords.map(
    ({ validatorAccount }) =>
      ({
        vote_account: validatorAccount.toBase58(),
        score: 1,
      } as ValidatorStats)
  )

  const { transaction } = await build(validators)

  const lookupTable = (
    await connection.getAddressLookupTable(marinade.config.lookupTableAddress)
  ).value
  if (!lookupTable) {
    throw new Error('Failed to load the Marinade lookup table')
  }
  const message = web3.TransactionMessage.decompile(transaction.message, {
    addressLookupTableAccounts: [lookupTable],
  })
  const creation = message.instructions.find(
    instruction =>
      instruction.programId.equals(web3.SystemProgram.programId) &&
      web3.SystemInstruction.decodeInstructionType(instruction) === 'Create' &&
      web3.SystemInstruction.decodeCreateAccount(instruction).programId.equals(
        web3.StakeProgram.programId
      )
  )
  if (!creation) {
    throw new Error('The stake pool withdraw does not create a stake account')
  }
  const { newAccountPubkey: stakeAccountAddress, lamports: prefunded } =
    web3.SystemInstruction.decodeCreateAccount(creation)
  console.log(
    `stake account ${stakeAccountAddress.toBase58()} pre-funded with ${prefunded}`
  )

  const expectedTopUp = frozenReserve.subn(prefunded)
  const toppedUp = message.instructions
    .filter(instruction => isTopUp(instruction, stakeAccountAddress))
    .reduce(
      (sum, instruction) =>
        sum.add(
          new BN(
            web3.SystemInstruction.decodeTransfer(
              instruction
            ).lamports.toString()
          )
        ),
      new BN(0)
    )
  if (!toppedUp.eq(expectedTopUp)) {
    throw new Error(`Expected top-up of ${expectedTopUp}, got ${toppedUp}`)
  }
  console.log(`SDK top-up: ${toppedUp} lamports`)

  const preFixMessage = new web3.TransactionMessage({
    payerKey: user.publicKey,
    recentBlockhash: message.recentBlockhash,
    instructions: message.instructions.filter(
      instruction => !isTopUp(instruction, stakeAccountAddress)
    ),
  }).compileToV0Message([lookupTable])
  const preFix = await connection.simulateTransaction(
    new web3.VersionedTransaction(preFixMessage),
    { sigVerify: false, replaceRecentBlockhash: true }
  )
  assertWrongStakeBalance(preFix.value.err, preFix.value.logs)

  transaction.sign([user])
  const signature = await connection.sendTransaction(transaction)
  await connection.confirmTransaction(
    { signature, ...(await connection.getLatestBlockhash()) },
    'confirmed'
  )
  console.log(`${name} confirmed: ${signature}`)

  await assertDepositedUnderMarinade(
    connection,
    marinadeState,
    user.publicKey,
    stakeAccountAddress
  )
}

async function main() {
  const connection = new web3.Connection(SURFPOOL_URL, 'confirmed')
  const mainnet = new web3.Connection(MAINNET_URL, 'confirmed')

  const liveRent = await alignForkRentWithMainnet(connection, mainnet)
  console.log(`live stake account rent taken from mainnet: ${liveRent}`)

  const user = web3.Keypair.generate()
  await setAccount(user.publicKey, {
    lamports: 1000 * web3.LAMPORTS_PER_SOL,
  })

  const marinade = new Marinade(
    new MarinadeConfig({ connection, publicKey: user.publicKey })
  )
  const marinadeState = await marinade.getMarinadeState()
  const { validatorRecords } = await marinadeState.getValidatorRecords()
  const voteAccount = validatorRecords[0].validatorAccount
  const { stakeRecords, capacity } = await marinadeState.getStakeRecords()
  if (stakeRecords.length + 3 > capacity) {
    throw new Error(
      `Marinade stake list has no room for the test deposits: ${stakeRecords.length}/${capacity}`
    )
  }

  const template = await connection.getAccountInfo(stakeRecords[0].stakeAccount)
  if (!template) {
    throw new Error(
      `Failed to read the Marinade stake account ${stakeRecords[0].stakeAccount.toBase58()}`
    )
  }
  const frozenReserve = new BN(
    new DataView(
      template.data.buffer,
      template.data.byteOffset,
      template.data.byteLength
    )
      .getBigUint64(OFFSET_RENT_EXEMPT_RESERVE, true)
      .toString()
  )
  const rentGap = frozenReserve.subn(liveRent)
  console.log(
    `frozen meta.rent_exempt_reserve: ${frozenReserve}, rent gap: ${rentGap}`
  )
  if (rentGap.lten(0)) {
    throw new Error(
      'The fork rent is not below the frozen reserve, nothing to reproduce'
    )
  }

  const { epoch: currentEpoch } = await connection.getEpochInfo()
  const cases = [
    {
      name: 'stake account delegated after the rent reduction',
      balanceLamports: STAKED_LAMPORTS.addn(liveRent),
      expectedTopUp: rentGap,
    },
    {
      name: 'stake account delegated before the rent reduction',
      balanceLamports: STAKED_LAMPORTS.add(frozenReserve),
      expectedTopUp: new BN(0),
    },
    {
      name: 'cooled down stake account that the SDK re-delegates',
      balanceLamports: STAKED_LAMPORTS.add(frozenReserve),
      expectedTopUp: rentGap,
      deactivationEpoch: currentEpoch - 1,
    },
  ]

  for (const {
    name,
    balanceLamports,
    expectedTopUp,
    deactivationEpoch,
  } of cases) {
    console.log(`\n=== ${name} ===`)
    const stakeAccountAddress = await synthesizeStakeAccount(
      Uint8Array.from(template.data),
      balanceLamports,
      voteAccount,
      user.publicKey,
      deactivationEpoch
    )
    const stakeAccountInfo = await getParsedStakeAccountInfo(
      connection,
      stakeAccountAddress
    )
    console.log(
      `lamports ${stakeAccountInfo.balanceLamports}, delegation.stake ${stakeAccountInfo.stakedLamports}, meta.rent_exempt_reserve ${stakeAccountInfo.rentExemptReserveLamports}`
    )

    const { transaction } = await marinade.depositStakeAccount(
      stakeAccountAddress
    )
    const topUps = transaction.instructions.filter(instruction =>
      isTopUp(instruction, stakeAccountAddress)
    )
    const toppedUp = topUps.reduce(
      (sum, instruction) =>
        sum.add(
          new BN(
            web3.SystemInstruction.decodeTransfer(
              instruction
            ).lamports.toString()
          )
        ),
      new BN(0)
    )
    if (!toppedUp.eq(expectedTopUp)) {
      throw new Error(`Expected top-up of ${expectedTopUp}, got ${toppedUp}`)
    }
    console.log(`SDK top-up: ${toppedUp} lamports`)

    if (deactivationEpoch === undefined) {
      await assertPreFixFails(
        connection,
        user,
        stakeAccountInfo,
        transaction,
        stakeAccountAddress,
        liveRent
      )
    }

    const signature = await web3.sendAndConfirmTransaction(
      connection,
      transaction,
      [user]
    )
    console.log(`deposit_stake_account confirmed: ${signature}`)

    const deposited = await getParsedStakeAccountInfo(
      connection,
      stakeAccountAddress
    )
    const expectedBalance = balanceLamports.add(expectedTopUp)
    if (!deposited.balanceLamports!.eq(expectedBalance)) {
      throw new Error(
        `Expected balance ${expectedBalance}, got ${deposited.balanceLamports}`
      )
    }
    await assertDepositedUnderMarinade(
      connection,
      marinadeState,
      user.publicKey,
      stakeAccountAddress
    )
  }

  for (const [name, build] of [
    [
      'depositStakePoolToken',
      (validators: ValidatorStats[]) =>
        marinade.depositStakePoolToken(
          STAKE_POOL_ADDRESS,
          POOL_TOKENS_TO_DEPOSIT,
          validators
        ),
    ],
    [
      'liquidateStakePoolToken',
      (validators: ValidatorStats[]) =>
        marinade.liquidateStakePoolToken(
          STAKE_POOL_ADDRESS,
          POOL_TOKENS_TO_DEPOSIT,
          validators
        ),
    ],
  ] as const) {
    await stakePoolTokenCase(
      connection,
      marinade,
      marinadeState,
      user,
      frozenReserve,
      name,
      build
    )
  }

  console.log('\nOK')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
