/* eslint-disable @typescript-eslint/no-explicit-any */
import { BN, ProgramAccount, web3 } from '@coral-xyz/anchor'
import {
  getAssociatedTokenAccountAddress,
  getOrCreateAssociatedTokenAccount,
  getParsedStakeAccountInfo,
} from './util/anchor'
import {
  DepositOptions,
  DepositStakeAccountOptions,
  ErrorMessage,
  MarinadeResult,
  ValidatorStats,
} from './marinade.types'
import {
  MarinadeFinanceProgram,
  addLiquidityInstructionBuilder,
  claimInstructionBuilder,
  depositStakeAccountInstructionBuilder,
  liquidUnstakeInstructionBuilder,
  orderUnstakeInstructionBuilder,
  removeLiquidityInstructionBuilder,
} from './programs/marinade-finance-program'
import { assertNotDefault, assertNotUndefinedAndReturn } from './util/assert'
import { TICKET_ACCOUNT_SIZE } from './marinade-state/borsh/ticket-account'
import {
  computeMsolAmount,
  ParsedStakeAccountInfo,
  proportionalBN,
} from './util'
import {
  DEFAULT_DIRECTED_STAKE_ROOT,
  DirectedStakeSdk,
  DirectedStakeVoteRecord,
  findVoteRecords,
  voteRecordAddress,
  withCreateVote,
  withRemoveVote,
  withUpdateVote,
} from '@marinade.finance/directed-stake-sdk'
import { withdrawStake } from '@solana/spl-stake-pool'
import {
  computeExpectedSOL,
  identifyValidatorFromTx,
  selectSpecificValidator,
} from './util/stake-pool-helpers'
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  StakeProgram,
  Transaction,
} from '@solana/web3.js'
import {
  getValidatorRecords,
  validatorDuplicationFlag,
} from './marinade-state/marinade-state'
import { MarinadeState } from './marinade-state/marinade-state.types'
import { MarinadeProgramBuilders } from './programs/marinade-program-builders'
import { isMarinadeReferralProgramBuilders } from './programs/marinade-referral-program'

/**
 * Constructs a DirectedStake contract SDK.
 *
 * @param connection - RPC connection to the Solana cluster
 * @param walletPublicKey - the user wallet public key that the SDK works with as default value
 * @returns directed stake sdk
 */
export function getDirectedStakeSdk({
  connection,
  walletPublicKey,
}: {
  connection: Connection
  walletPublicKey: PublicKey | null
}): DirectedStakeSdk {
  return new DirectedStakeSdk({
    connection,
    wallet: {
      signTransaction: async () => new Promise(() => new web3.Transaction()),
      signAllTransactions: async () =>
        new Promise(() => [new web3.Transaction()]),
      publicKey: walletPublicKey ?? web3.PublicKey.default,
    },
  })
}

/**
 * Fetches the voteRecord of a given user
 *
 * @param {web3.PublicKey} userPublicKey - The PublicKey of the user
 * @param {DirectedStakeSdk} directedStakeSdk - The DirectedStakeSdk instance
 * @returns {Promise<{voteRecord: ProgramAccount<DirectedStakeVoteRecord> | undefined, address: web3.PublicKey}>} - The voteRecord and its address
 */
export async function getUsersVoteRecord({
  directedStakeSdk,
  userPublicKey,
}: {
  directedStakeSdk: DirectedStakeSdk
  userPublicKey: web3.PublicKey
}): Promise<{
  voteRecord: ProgramAccount<DirectedStakeVoteRecord> | undefined
  address: web3.PublicKey
}> {
  const address = voteRecordAddress({
    root: new web3.PublicKey(DEFAULT_DIRECTED_STAKE_ROOT),
    owner: userPublicKey,
  }).address

  const voteRecords = await findVoteRecords({
    sdk: directedStakeSdk,
    owner: userPublicKey,
  })

  return {
    voteRecord: voteRecords.length === 1 ? voteRecords[0] : undefined,
    address,
  }
}

/**
 * Returns a transaction with the instructions to
 * Add liquidity to the liquidity pool and receive LP tokens
 *
 *
 * @param {BN} amountLamports - The amount of lamports added to the liquidity pool
 */
export async function addLiquidity({
  program,
  marinadeState,
  ownerAddress,
  amountLamports,
}: {
  program: MarinadeFinanceProgram
  marinadeState: MarinadeState
  ownerAddress: web3.PublicKey
  amountLamports: BN
}): Promise<MarinadeResult.AddLiquidity> {
  const transaction = new web3.Transaction()

  const {
    associatedTokenAccountAddress: associatedLPTokenAccountAddress,
    createAssociateTokenInstruction,
  } = await getOrCreateAssociatedTokenAccount(
    program.provider,
    marinadeState.liqPool.lpMint,
    ownerAddress
  )

  if (createAssociateTokenInstruction) {
    transaction.add(createAssociateTokenInstruction)
  }

  const addLiquidityInstruction = await addLiquidityInstructionBuilder({
    program,
    marinadeState,
    associatedLPTokenAccountAddress,
    ownerAddress,
    amountLamports,
  })

  transaction.add(addLiquidityInstruction)

  return {
    associatedLPTokenAccountAddress,
    transaction,
  }
}

/**
 * Returns a transaction with the instructions to
 * Burn LP tokens and get SOL and mSOL back from the liquidity pool
 *
 *
 * @param {BN} amountLamports - The amount of LP tokens burned
 */
export async function removeLiquidity({
  program,
  marinadeState,
  ownerAddress,
  amountLamports,
}: {
  program: MarinadeFinanceProgram
  marinadeState: MarinadeState
  ownerAddress: web3.PublicKey
  amountLamports: BN
}): Promise<MarinadeResult.RemoveLiquidity> {
  const transaction = new web3.Transaction()

  const associatedLPTokenAccountAddress =
    await getAssociatedTokenAccountAddress(
      marinadeState.liqPool.lpMint,
      ownerAddress
    )

  const {
    associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
    createAssociateTokenInstruction,
  } = await getOrCreateAssociatedTokenAccount(
    program.provider,
    marinadeState.msolMint,
    ownerAddress
  )

  if (createAssociateTokenInstruction) {
    transaction.add(createAssociateTokenInstruction)
  }

  const removeLiquidityInstruction = await removeLiquidityInstructionBuilder({
    program,
    marinadeState,
    amountLamports,
    ownerAddress,
    associatedLPTokenAccountAddress,
    associatedMSolTokenAccountAddress,
  })

  transaction.add(removeLiquidityInstruction)

  return {
    associatedLPTokenAccountAddress,
    associatedMSolTokenAccountAddress,
    transaction,
  }
}

/**
 * Creates necessary directed stake voting instructions for the specified validator.
 * If the vote address is left undefined the standard delegation strategy is used.
 *
 * @param {DirectedStakeSdk} directedStakeSdk - The DirectedStakeSdk instance
 * @param {web3.PublicKey} validatorVoteAddress - The vote address to identify the validator
 */
export async function createDirectedStakeVoteIx({
  directedStakeSdk,
  validatorVoteAddress,
}: {
  directedStakeSdk: DirectedStakeSdk
  validatorVoteAddress?: web3.PublicKey
}): Promise<web3.TransactionInstruction | undefined> {
  const owner = assertNotUndefinedAndReturn(
    directedStakeSdk.program.provider.publicKey,
    ErrorMessage.NO_PUBLIC_KEY
  )
  // default key would mean not defined in the config
  assertNotDefault(owner, ErrorMessage.NO_PUBLIC_KEY)
  const { voteRecord } = await getUsersVoteRecord({
    directedStakeSdk,
    userPublicKey: owner,
  })

  if (!voteRecord) {
    if (validatorVoteAddress) {
      return (
        await withCreateVote({
          sdk: directedStakeSdk,
          validatorVote: validatorVoteAddress,
        })
      ).instruction
    }
    return
  }

  if (validatorVoteAddress) {
    return (
      await withUpdateVote({
        sdk: directedStakeSdk,
        validatorVote: validatorVoteAddress,
        voteRecord: voteRecord.publicKey,
      })
    ).instruction
  }

  return (
    await withRemoveVote({
      sdk: directedStakeSdk,
      voteRecord: voteRecord.publicKey,
    })
  ).instruction
}

/**
 * Returns a transaction with the instructions to
 * Stake SOL in exchange for mSOL
 *
 *
 * @param {MarinadeReferralProgram} referralProgram - Marinade Referral Program
 * @param {BN} amountLamports - The amount lamports staked
 * @param {DepositOptions} options - Additional deposit options
 */
export async function deposit({
  program,
  marinadeState,
  programBuilders,
  ownerAddress,
  amountLamports,
  options = {},
}: {
  program: MarinadeFinanceProgram
  marinadeState: MarinadeState
  programBuilders: MarinadeProgramBuilders
  ownerAddress: web3.PublicKey
  amountLamports: BN
  options: DepositOptions
}): Promise<MarinadeResult.Deposit> {
  const feePayer = ownerAddress
  const mintToOwnerAddress = options.mintToOwnerAddress ?? ownerAddress
  const transaction = new web3.Transaction()

  const {
    associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
    createAssociateTokenInstruction,
  } = await getOrCreateAssociatedTokenAccount(
    program.provider,
    marinadeState.msolMint,
    mintToOwnerAddress,
    feePayer
  )

  if (createAssociateTokenInstruction) {
    transaction.add(createAssociateTokenInstruction)
  }

  const depositInstruction = await programBuilders.depositInstructionBuilder({
    amountLamports,
    marinadeState,
    transferFrom: feePayer,
    associatedMSolTokenAccountAddress,
  })

  transaction.add(depositInstruction)

  const directedStakeSdk = getDirectedStakeSdk({
    connection: program.provider.connection,
    walletPublicKey: ownerAddress,
  })
  const directedStakeInstruction = await createDirectedStakeVoteIx({
    directedStakeSdk,
    validatorVoteAddress: options.directToValidatorVoteAddress,
  })
  if (directedStakeInstruction) {
    transaction.add(directedStakeInstruction)
  }

  return {
    associatedMSolTokenAccountAddress,
    transaction,
  }
}

/**
 * Returns a transaction with the instructions to
 * Swap your mSOL to get back SOL immediately using the liquidity pool
 *
 *
 * @param {BN} amountLamports - The amount of mSOL exchanged for SOL
 */
export async function liquidUnstake({
  program,
  marinadeState,
  programBuilders,
  ownerAddress,
  amountLamports,
  associatedMSolTokenAccountAddress,
}: {
  program: MarinadeFinanceProgram
  marinadeState: MarinadeState
  programBuilders: MarinadeProgramBuilders
  ownerAddress: web3.PublicKey
  amountLamports: BN
  associatedMSolTokenAccountAddress?: web3.PublicKey
}): Promise<MarinadeResult.LiquidUnstake> {
  const transaction = new web3.Transaction()

  if (!associatedMSolTokenAccountAddress) {
    const associatedTokenAccountInfos = await getOrCreateAssociatedTokenAccount(
      program.provider,
      marinadeState.msolMint,
      ownerAddress
    )
    const createAssociateTokenInstruction =
      associatedTokenAccountInfos.createAssociateTokenInstruction
    associatedMSolTokenAccountAddress =
      associatedTokenAccountInfos.associatedTokenAccountAddress

    if (createAssociateTokenInstruction) {
      transaction.add(createAssociateTokenInstruction)
    }
  }

  const liquidUnstakeInstruction =
    await programBuilders.liquidUnstakeInstructionBuilder({
      amountLamports,
      marinadeState,
      ownerAddress,
      associatedMSolTokenAccountAddress,
    })

  transaction.add(liquidUnstakeInstruction)

  return {
    associatedMSolTokenAccountAddress,
    transaction,
  }
}

/**
 * Returns a transaction with the instructions to
 * Deposit a delegated stake account.
 * Note that the stake must be fully activated and the validator must be known to Marinade
 *
 *
 * @param {web3.PublicKey} stakeAccountAddress - The account to be deposited
 * @param {DepositStakeAccountOptions} options - Additional deposit options
 */
export async function depositStakeAccount({
  program,
  marinadeState,
  programBuilders,
  ownerAddress,
  stakeAccountAddress,
  options = {},
}: {
  program: MarinadeFinanceProgram
  marinadeState: MarinadeState
  programBuilders: MarinadeProgramBuilders
  ownerAddress: web3.PublicKey
  stakeAccountAddress: web3.PublicKey
  options?: DepositStakeAccountOptions
}): Promise<MarinadeResult.DepositStakeAccount> {
  const stakeAccountInfo = await getParsedStakeAccountInfo(
    program.provider,
    stakeAccountAddress
  )
  const rent =
    await program.provider.connection.getMinimumBalanceForRentExemption(
      web3.StakeProgram.space
    )

  return depositStakeAccountByAccount({
    program,
    marinadeState,
    programBuilders,
    ownerAddress,
    stakeAccountInfo,
    rent,
    options,
  })
}

/**
 * @beta
 *
 * Returns a transaction with the instructions to
 * Deposit a deactivating stake account.
 * Note that the stake must be deactivating and the validator must be known to Marinade
 *
 *
 * @param {web3.PublicKey} stakeAccountAddress - The account to be deposited
 * @param {DepositStakeAccountOptions} options - Additional deposit options
 */
export async function depositDeactivatingStakeAccount({
  program,
  marinadeState,
  ownerAddress,
  stakeAccountAddress,
  options = {},
}: {
  program: MarinadeFinanceProgram
  marinadeState: MarinadeState
  ownerAddress: web3.PublicKey
  stakeAccountAddress: web3.PublicKey
  options?: DepositStakeAccountOptions
}): Promise<MarinadeResult.DepositDeactivatingStakeAccount> {
  const stakeAccountInfo = await getParsedStakeAccountInfo(
    program.provider,
    stakeAccountAddress
  )

  if (!stakeAccountInfo.voterAddress) {
    throw new Error("Stake account's votes could not be fetched/parsed.")
  }

  const delegateTransaction = StakeProgram.delegate({
    stakePubkey: stakeAccountAddress,
    authorizedPubkey: ownerAddress,
    votePubkey: stakeAccountInfo.voterAddress,
  })

  const {
    associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
    createAssociateTokenInstruction,
  } = await getOrCreateAssociatedTokenAccount(
    program.provider,
    marinadeState.msolMint,
    ownerAddress
  )

  if (createAssociateTokenInstruction) {
    delegateTransaction.instructions.push(createAssociateTokenInstruction)
  }

  const duplicationFlag = validatorDuplicationFlag(
    marinadeState,
    stakeAccountInfo.voterAddress
  )
  const { validatorRecords } = await getValidatorRecords(program, marinadeState)
  const validatorLookupIndex = validatorRecords.findIndex(
    ({ validatorAccount }) =>
      validatorAccount.equals(stakeAccountInfo.voterAddress!)
  )
  const validatorIndex =
    validatorLookupIndex === -1
      ? marinadeState.validatorSystem.validatorList.count
      : validatorLookupIndex

  const depositInstruction = await depositStakeAccountInstructionBuilder({
    program,
    marinadeState,
    validatorIndex,
    duplicationFlag,
    ownerAddress,
    stakeAccountAddress,
    authorizedWithdrawerAddress: ownerAddress,
    associatedMSolTokenAccountAddress,
  })

  delegateTransaction.instructions.push(depositInstruction)

  const directedStakeSdk = getDirectedStakeSdk({
    connection: program.provider.connection,
    walletPublicKey: ownerAddress,
  })
  const directedStakeInstruction = await createDirectedStakeVoteIx({
    directedStakeSdk,
    validatorVoteAddress: options.directToValidatorVoteAddress,
  })
  if (directedStakeInstruction) {
    delegateTransaction.add(directedStakeInstruction)
  }

  return {
    transaction: delegateTransaction,
    associatedMSolTokenAccountAddress,
  }
}

/**
 * Returns a transaction with the instructions to
 * Deposit a delegated stake account.
 * Note that the stake must be fully activated and the validator must be known to Marinade
 *
 *
 * @param {MarinadeState} state - Marinade State needed for retrieving validator info
 * @param {ParsedStakeAccountInfo} stakeAccountInfo - Parsed Stake Account info
 * @param {number} rent - Rent needed for a stake account
 * @param {DepositStakeAccountOptions} options - Additional deposit options
 */
export async function depositStakeAccountByAccount({
  program,
  marinadeState,
  programBuilders,
  ownerAddress,
  stakeAccountInfo,
  rent,
  options = {},
}: {
  program: MarinadeFinanceProgram
  marinadeState: MarinadeState
  programBuilders: MarinadeProgramBuilders
  ownerAddress: web3.PublicKey
  stakeAccountInfo: ParsedStakeAccountInfo
  rent: number
  options?: DepositStakeAccountOptions
}): Promise<MarinadeResult.DepositStakeAccount> {
  const transaction = new web3.Transaction()
  const currentEpoch = await program.provider.connection.getEpochInfo()

  const {
    authorizedWithdrawerAddress,
    voterAddress,
    activationEpoch,
    isCoolingDown,
    isLockedUp,
    stakedLamports,
    balanceLamports,
  } = stakeAccountInfo

  if (!authorizedWithdrawerAddress) {
    throw new Error('Withdrawer address is not available!')
  }

  if (isLockedUp) {
    throw new Error('The stake account is locked up!')
  }

  if (!activationEpoch || !voterAddress) {
    throw new Error('The stake account is not delegated!')
  }

  if (isCoolingDown) {
    transaction.add(
      web3.StakeProgram.delegate({
        stakePubkey: stakeAccountInfo.address,
        authorizedPubkey: ownerAddress,
        votePubkey: voterAddress,
      })
    )
  }

  if (stakedLamports && balanceLamports?.gt(stakedLamports)) {
    const lamportsToWithdraw =
      balanceLamports.sub(stakedLamports).toNumber() - rent
    if (lamportsToWithdraw > 0)
      transaction.add(
        web3.StakeProgram.withdraw({
          stakePubkey: stakeAccountInfo.address,
          authorizedPubkey: ownerAddress,
          toPubkey: ownerAddress,
          lamports: lamportsToWithdraw,
        })
      )
  }

  const waitEpochs = 2
  const earliestDepositEpoch = activationEpoch.addn(waitEpochs)
  if (earliestDepositEpoch.gtn(currentEpoch.epoch)) {
    throw new Error(
      `Deposited stake ${stakeAccountInfo.address} is not activated yet. Wait for #${earliestDepositEpoch} epoch`
    )
  }

  const { validatorRecords } = await getValidatorRecords(program, marinadeState)
  const validatorLookupIndex = validatorRecords.findIndex(
    ({ validatorAccount }) => validatorAccount.equals(voterAddress)
  )
  const validatorIndex =
    validatorLookupIndex === -1
      ? marinadeState.validatorSystem.validatorList.count
      : validatorLookupIndex

  const duplicationFlag = validatorDuplicationFlag(marinadeState, voterAddress)

  const {
    associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
    createAssociateTokenInstruction,
  } = await getOrCreateAssociatedTokenAccount(
    program.provider,
    marinadeState.msolMint,
    ownerAddress
  )

  if (createAssociateTokenInstruction) {
    transaction.add(createAssociateTokenInstruction)
  }

  const depositStakeAccountInstruction =
    await programBuilders.depositStakeAccountInstructionBuilder({
      validatorIndex,
      marinadeState,
      duplicationFlag,
      authorizedWithdrawerAddress,
      associatedMSolTokenAccountAddress,
      ownerAddress,
      stakeAccountAddress: stakeAccountInfo.address,
    })

  transaction.add(depositStakeAccountInstruction)

  const directedStakeSdk = getDirectedStakeSdk({
    connection: program.provider.connection,
    walletPublicKey: ownerAddress,
  })
  const directedStakeInstruction = await createDirectedStakeVoteIx({
    directedStakeSdk,
    validatorVoteAddress: options.directToValidatorVoteAddress,
  })
  if (directedStakeInstruction) {
    transaction.add(directedStakeInstruction)
  }

  return {
    associatedMSolTokenAccountAddress,
    voterAddress,
    transaction,
    mintRatio: marinadeState.msolPrice.toNumber(),
  }
}

/**
 * @beta
 *
 * Generates a transaction to partially convert a fully activated delegated stake account into mSOL,
 * while the remaining balance continues to be staked in its native form.
 *
 * Requirements:
 * - The stake's validator should be recognized by Marinade.
 * - The transaction should be executed immediately after being generated.
 * - A minimum amount of 1 SOL is required for conversion to mSOL.
 *
 * @param {web3.PublicKey} stakeAccountAddress - The account to be deposited
 * @param {BN} solToKeep - Amount of SOL lamports to keep
 * @param {DepositStakeAccountOptions} options - Additional deposit options
 */
export async function partiallyDepositStakeAccount({
  program,
  marinadeState,
  programBuilders,
  ownerAddress,
  stakeAccountAddress,
  solToKeep,
  options = {},
}: {
  program: MarinadeFinanceProgram
  marinadeState: MarinadeState
  programBuilders: MarinadeProgramBuilders
  ownerAddress: web3.PublicKey
  stakeAccountAddress: web3.PublicKey
  solToKeep: BN
  options?: DepositStakeAccountOptions
}): Promise<MarinadeResult.PartiallyDepositStakeAccount> {
  const stakeAccountInfo = await getParsedStakeAccountInfo(
    program.provider,
    stakeAccountAddress
  )

  if (
    stakeAccountInfo.balanceLamports &&
    stakeAccountInfo.balanceLamports?.sub(solToKeep).toNumber() < 1
  ) {
    throw new Error("Can't deposit less than 1 SOL")
  }

  const rent =
    await program.provider.connection.getMinimumBalanceForRentExemption(
      web3.StakeProgram.space
    )

  const newStakeAccountKeypair = Keypair.generate()

  const splitStakeTx = StakeProgram.split({
    stakePubkey: stakeAccountAddress,
    authorizedPubkey: ownerAddress,
    splitStakePubkey: newStakeAccountKeypair.publicKey,
    lamports: solToKeep.toNumber(),
  })

  const {
    transaction: depositTx,
    associatedMSolTokenAccountAddress,
    voterAddress,
  } = await depositStakeAccountByAccount({
    program,
    marinadeState,
    programBuilders,
    ownerAddress,
    stakeAccountInfo,
    rent,
    options,
  })

  splitStakeTx.instructions.push(...depositTx.instructions)

  return {
    transaction: splitStakeTx,
    associatedMSolTokenAccountAddress,
    stakeAccountKeypair: newStakeAccountKeypair,
    voterAddress,
  }
}

/**
 * @beta
 *
 * Generates a transaction to convert an activating stake account into mSOL,
 * while the remaining balance continues to be staked in its native form.
 *
 * Requirements:
 * - The stake's validator should be recognized by Marinade.
 * - The transaction should be executed immediately after being generated.
 *
 * @param {web3.PublicKey} stakeAccountAddress - The account to be deposited
 * @param {BN} solToKeep - Amount of SOL lamports to keep as a stake account
 * @param {DepositStakeAccountOptions} options - Additional deposit options
 */
export async function depositActivatingStakeAccount({
  program,
  marinadeState,
  programBuilders,
  ownerAddress,
  stakeAccountAddress,
  solToKeep,
  options = {},
}: {
  program: MarinadeFinanceProgram
  marinadeState: MarinadeState
  programBuilders: MarinadeProgramBuilders
  ownerAddress: web3.PublicKey
  stakeAccountAddress: web3.PublicKey
  solToKeep: BN
  options: DepositStakeAccountOptions
}): Promise<MarinadeResult.PartiallyDepositStakeAccount> {
  const stakeAccountInfo = await getParsedStakeAccountInfo(
    program.provider,
    stakeAccountAddress
  )

  if (!stakeAccountInfo.stakedLamports) {
    throw new Error(
      `Stake account ${stakeAccountInfo.address} does not have staked lamports`
    )
  }

  const rent =
    await program.provider.connection.getMinimumBalanceForRentExemption(
      web3.StakeProgram.space
    )
  const lamportsToWithdraw = stakeAccountInfo.stakedLamports
    .sub(solToKeep)
    .add(new BN(rent))

  const newStakeAccountKeypair = Keypair.generate()
  const transaction = new Transaction()

  if (solToKeep.gt(new BN(0))) {
    const splitStakeTx = StakeProgram.split({
      stakePubkey: stakeAccountAddress,
      authorizedPubkey: ownerAddress,
      splitStakePubkey: newStakeAccountKeypair.publicKey,
      lamports: solToKeep.toNumber(),
    })
    transaction.add(...splitStakeTx.instructions)
  }

  const deactivateTx = StakeProgram.deactivate({
    stakePubkey: stakeAccountAddress,
    authorizedPubkey: ownerAddress,
  })
  transaction.add(...deactivateTx.instructions)

  const withdrawTx = StakeProgram.withdraw({
    stakePubkey: stakeAccountAddress,
    authorizedPubkey: ownerAddress,
    toPubkey: ownerAddress,
    lamports: lamportsToWithdraw.toNumber(),
  })
  transaction.add(...withdrawTx.instructions)

  const { transaction: depositTx, associatedMSolTokenAccountAddress } =
    await deposit({
      program,
      marinadeState,
      programBuilders,
      ownerAddress,
      amountLamports: lamportsToWithdraw,
      options: {
        directToValidatorVoteAddress: options.directToValidatorVoteAddress,
      },
    })

  transaction.instructions.push(...depositTx.instructions)

  return {
    transaction,
    associatedMSolTokenAccountAddress,
    stakeAccountKeypair: solToKeep.gt(new BN(0))
      ? newStakeAccountKeypair
      : undefined,
  }
}

/**
 * Returns a transaction with the instructions to
 * Liquidate a delegated stake account.
 * Note that the stake must be fully activated and the validator must be known to Marinade
 * and that the transaction should be executed immediately after creation.
 *
 * @param {web3.PublicKey} stakeAccountAddress - The account to be deposited
 * @param {BN} mSolToKeep - Optional amount of mSOL lamports to keep
 */
export async function liquidateStakeAccount({
  program,
  marinadeState,
  programBuilders,
  ownerAddress,
  stakeAccountAddress,
  mSolToKeep,
}: {
  program: MarinadeFinanceProgram
  marinadeState: MarinadeState
  programBuilders: MarinadeProgramBuilders
  ownerAddress: web3.PublicKey
  stakeAccountAddress: web3.PublicKey
  mSolToKeep?: BN
}): Promise<MarinadeResult.LiquidateStakeAccount> {
  const stakeAccountInfo = await getParsedStakeAccountInfo(
    program.provider,
    stakeAccountAddress
  )
  const rent =
    await program.provider.connection.getMinimumBalanceForRentExemption(
      web3.StakeProgram.space
    )

  const {
    transaction: depositTx,
    associatedMSolTokenAccountAddress,
    voterAddress,
  } = await depositStakeAccountByAccount({
    program,
    marinadeState,
    programBuilders,
    ownerAddress,
    stakeAccountInfo,
    rent,
  })

  let mSolAmountToReceive = computeMsolAmount(
    stakeAccountInfo.stakedLamports ?? new BN(0),
    marinadeState
  )
  // when working with referral partner the costs of the deposit operation is subtracted
  //  from the mSOL amount the user receives
  if (isMarinadeReferralProgramBuilders(programBuilders)) {
    const partnerOperationFee =
      programBuilders.referralState.operationDepositStakeAccountFee
    mSolAmountToReceive = mSolAmountToReceive.sub(
      proportionalBN(
        mSolAmountToReceive,
        new BN(partnerOperationFee),
        new BN(10_000)
      )
    )
  }

  const unstakeAmountMSol = mSolAmountToReceive.sub(mSolToKeep ?? new BN(0))
  const { transaction: unstakeTx } = await liquidUnstake({
    program,
    marinadeState,
    programBuilders,
    ownerAddress,
    amountLamports: unstakeAmountMSol,
    associatedMSolTokenAccountAddress,
  })

  return {
    transaction: depositTx.add(unstakeTx),
    associatedMSolTokenAccountAddress,
    voterAddress,
  }
}

/**
 * @beta
 *
 * Returns a transaction with the instructions to
 * Partially liquidate a delegated stake account, while the rest remains staked natively.
 * Note that the stake must be fully activated and the validator must be known to Marinade
 * and that the transaction should be executed immediately after creation.
 *
 * @param {web3.PublicKey} stakeAccountAddress - The account to be deposited
 * @param {BN} solToKeep - Amount of SOL lamports to keep
 */
export async function partiallyLiquidateStakeAccount({
  program,
  marinadeState,
  programBuilders,
  ownerAddress,
  stakeAccountAddress,
  solToKeep,
}: {
  program: MarinadeFinanceProgram
  marinadeState: MarinadeState
  programBuilders: MarinadeProgramBuilders
  ownerAddress: web3.PublicKey
  stakeAccountAddress: web3.PublicKey
  solToKeep: BN
}): Promise<MarinadeResult.PartiallyDepositStakeAccount> {
  const stakeAccountInfo = await getParsedStakeAccountInfo(
    program.provider,
    stakeAccountAddress
  )

  const rent =
    await program.provider.connection.getMinimumBalanceForRentExemption(
      web3.StakeProgram.space
    )

  const stakeToLiquidate = stakeAccountInfo.stakedLamports?.sub(solToKeep)
  if (!stakeToLiquidate || stakeToLiquidate.toNumber() < 1) {
    throw new Error("Can't liquidate less than 1 SOL")
  }

  const newStakeAccountKeypair = Keypair.generate()

  const splitStakeInstruction = StakeProgram.split({
    stakePubkey: stakeAccountAddress,
    authorizedPubkey: ownerAddress,
    splitStakePubkey: newStakeAccountKeypair.publicKey,
    lamports: solToKeep.toNumber(),
  })

  const {
    transaction: depositTx,
    associatedMSolTokenAccountAddress,
    voterAddress,
  } = await depositStakeAccountByAccount({
    program,
    marinadeState,
    programBuilders,
    ownerAddress,
    stakeAccountInfo,
    rent,
  })

  depositTx.instructions.unshift(...splitStakeInstruction.instructions)

  let mSolAmountToReceive = computeMsolAmount(stakeToLiquidate, marinadeState)
  // when working with referral partner the costs of the deposit operation is subtracted from the mSOL amount the user receives
  if (isMarinadeReferralProgramBuilders(programBuilders)) {
    const partnerOperationFee =
      programBuilders.referralState.operationDepositStakeAccountFee
    mSolAmountToReceive = mSolAmountToReceive.sub(
      proportionalBN(
        mSolAmountToReceive,
        new BN(partnerOperationFee),
        new BN(10_000)
      )
    )
  }

  const { transaction: unstakeTx } = await liquidUnstake({
    program,
    marinadeState,
    programBuilders,
    ownerAddress,
    amountLamports: mSolAmountToReceive,
    associatedMSolTokenAccountAddress,
  })

  return {
    transaction: depositTx.add(unstakeTx),
    associatedMSolTokenAccountAddress,
    stakeAccountKeypair: newStakeAccountKeypair,
    voterAddress,
  }
}

/**
 * Returns a transaction with the instructions to
 * Order Unstake to create a ticket which can be claimed later (with {@link claim}).
 *
 * @param {BN} msolAmount - The amount of mSOL in lamports to order for unstaking
 */
export async function orderUnstake(
  program: MarinadeFinanceProgram,
  marinadeState: MarinadeState,
  ownerAddress: web3.PublicKey,
  msolAmount: BN
): Promise<MarinadeResult.OrderUnstake> {
  const associatedMSolTokenAccountAddress =
    await getAssociatedTokenAccountAddress(marinadeState.msolMint, ownerAddress)
  const ticketAccountKeypair = web3.Keypair.generate()
  const rent =
    await program.provider.connection.getMinimumBalanceForRentExemption(
      TICKET_ACCOUNT_SIZE
    )
  const createAccountInstruction = web3.SystemProgram.createAccount({
    fromPubkey: ownerAddress,
    newAccountPubkey: ticketAccountKeypair.publicKey,
    lamports: rent,
    space: TICKET_ACCOUNT_SIZE,
    programId: program.programId,
  })

  const orderUnstakeInstruction = await orderUnstakeInstructionBuilder({
    program,
    marinadeState,
    msolAmount,
    ownerAddress,
    associatedMSolTokenAccountAddress,
    newTicketAccount: ticketAccountKeypair.publicKey,
  })

  const transaction = new web3.Transaction().add(
    createAccountInstruction,
    orderUnstakeInstruction
  )

  return {
    ticketAccountKeypair,
    transaction,
    associatedMSolTokenAccountAddress,
  }
}

/**
 * Returns a transaction with the instructions to
 * claim a ticket (created by {@link orderUnstake} beforehand).
 * Claimed SOLs will be sent to owner address.
 *
 * @param {web3.PublicKey} ticketAccount - Address of the ticket account for SOLs being claimed from
 */
export async function claim(
  program: MarinadeFinanceProgram,
  marinadeState: MarinadeState,
  ownerAddress: web3.PublicKey,
  ticketAccount: web3.PublicKey
): Promise<MarinadeResult.Claim> {
  const claimInstruction = await claimInstructionBuilder({
    program,
    marinadeState,
    ticketAccount,
    transferSolTo: ownerAddress,
  })

  const transaction = new web3.Transaction().add(claimInstruction)

  return {
    transaction,
  }
}

/**
 * @beta
 *
 * Returns a transaction with the instructions to
 * Deposit an amount of stake pool tokens.
 *
 * This method is in beta stage. It may be changed or removed in future versions.
 *
 * @param {web3.PublicKey} stakePoolTokenAddress - The stake pool token account to be deposited
 * @param {number} amountToDeposit - Amount to deposit
 * @param {ValidatorStats[]} validators - List of validators to prioritize where to take the stake from
 */
export async function depositStakePoolToken(
  program: MarinadeFinanceProgram,
  marinadeState: MarinadeState,
  ownerAddress: web3.PublicKey,
  programBuilders: MarinadeProgramBuilders,
  lookupTableAddress: web3.PublicKey,
  stakePoolTokenAddress: web3.PublicKey,
  amountToDeposit: number,
  validators: ValidatorStats[],
  options: DepositOptions = {}
): Promise<MarinadeResult.LiquidateStakePoolToken> {
  const lookupTable = (
    await program.provider.connection.getAddressLookupTable(lookupTableAddress)
  ).value
  if (!lookupTable) {
    throw new Error('Failed to load the lookup table')
  }

  const expectedSOL = await computeExpectedSOL(
    amountToDeposit,
    program.provider.connection,
    stakePoolTokenAddress
  )

  // Due to our contract 1 SOL limit for Stake accounts we can't accept less than equivalent of 1 SOL
  if (expectedSOL / LAMPORTS_PER_SOL < 1) {
    throw new Error("Can't convert less than equivalent of 1 SOL")
  }

  const instructions: web3.TransactionInstruction[] = []

  const validatorSet = new Set(
    validators.filter(v => v.score).map(v => v.vote_account)
  )
  const withdrawTx = await withdrawStake(
    program.provider.connection,
    stakePoolTokenAddress,
    ownerAddress,
    amountToDeposit,
    undefined,
    undefined,
    undefined,
    undefined,
    (a: any, b: any) => selectSpecificValidator(a, b, validatorSet)
  )

  instructions.push(...withdrawTx.instructions)

  const {
    associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
    createAssociateTokenInstruction,
  } = await getOrCreateAssociatedTokenAccount(
    program.provider,
    marinadeState.msolMint,
    ownerAddress
  )

  if (createAssociateTokenInstruction) {
    instructions.push(createAssociateTokenInstruction)
  }

  const { duplicationFlag, validatorIndex } = await identifyValidatorFromTx(
    withdrawTx.instructions,
    program,
    marinadeState
  )

  const depositInstruction =
    await programBuilders.depositStakeAccountInstructionBuilder({
      validatorIndex,
      marinadeState,
      duplicationFlag,
      ownerAddress,
      stakeAccountAddress: withdrawTx.signers[1].publicKey,
      authorizedWithdrawerAddress: ownerAddress,
      associatedMSolTokenAccountAddress,
    })

  instructions.push(depositInstruction)

  const directedStakeSdk = getDirectedStakeSdk({
    connection: program.provider.connection,
    walletPublicKey: ownerAddress,
  })
  const directedStakeInstruction = await createDirectedStakeVoteIx({
    directedStakeSdk,
    validatorVoteAddress: options.directToValidatorVoteAddress,
  })
  if (directedStakeInstruction) {
    instructions.push(directedStakeInstruction)
  }

  const { blockhash: recentBlockhash } =
    await program.provider.connection.getLatestBlockhash('finalized')

  const transactionMessage = new web3.TransactionMessage({
    payerKey: ownerAddress,
    recentBlockhash,
    instructions,
  }).compileToV0Message([lookupTable])
  const transaction = new web3.VersionedTransaction(transactionMessage)
  transaction.sign(withdrawTx.signers)

  return {
    associatedMSolTokenAccountAddress,
    transaction,
  }
}

/**
 * @beta
 *
 * Returns a transaction with the instructions to
 * Liquidate an amount of stake pool tokens.
 *
 * This method is in beta stage. It may be changed or removed in future versions.
 *
 * @param {web3.PublicKey} stakePoolTokenAddress - The stake pool token account to be liquidated
 * @param {number} amountToLiquidate - Amount to liquidate
 * @param {ValidatorStats[]} validators - List of validators to prioritize where to take the stake from
 */
export async function liquidateStakePoolToken(
  program: MarinadeFinanceProgram,
  marinadeState: MarinadeState,
  ownerAddress: web3.PublicKey,
  programBuilders: MarinadeProgramBuilders,
  lookupTableAddress: web3.PublicKey,
  stakePoolTokenAddress: web3.PublicKey,
  amountToLiquidate: number,
  validators: ValidatorStats[]
): Promise<MarinadeResult.LiquidateStakePoolToken> {
  const lookupTable = (
    await program.provider.connection.getAddressLookupTable(lookupTableAddress)
  ).value
  if (!lookupTable) {
    throw new Error('Failed to load the lookup table')
  }

  const instructions: web3.TransactionInstruction[] = []

  const validatorSet = new Set(
    validators.filter(v => v.score).map(v => v.vote_account)
  )
  const withdrawTx = await withdrawStake(
    program.provider.connection,
    stakePoolTokenAddress,
    ownerAddress,
    amountToLiquidate,
    undefined,
    undefined,
    undefined,
    undefined,
    (a: any, b: any) => selectSpecificValidator(a, b, validatorSet)
  )

  const expectedSOL = await computeExpectedSOL(
    amountToLiquidate,
    program.provider.connection,
    stakePoolTokenAddress
  )

  // Due to our contract 1 SOL limit for Stake accounts we can't accept less than equivalent of 1 SOL
  if (expectedSOL / LAMPORTS_PER_SOL < 1) {
    throw new Error("Can't convert less than equivalent of 1 SOL")
  }

  let mSolAmountToReceive = computeMsolAmount(
    new BN(expectedSOL),
    marinadeState
  )
  // when working with referral partner the costs of the deposit operation is subtracted from the mSOL amount the user receives
  if (isMarinadeReferralProgramBuilders(programBuilders)) {
    const partnerOperationFee =
      programBuilders.referralState.operationDepositStakeAccountFee
    mSolAmountToReceive = mSolAmountToReceive.sub(
      proportionalBN(
        mSolAmountToReceive,
        new BN(partnerOperationFee),
        new BN(10_000)
      )
    )
  }

  instructions.push(...withdrawTx.instructions)

  const {
    associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
    createAssociateTokenInstruction,
  } = await getOrCreateAssociatedTokenAccount(
    program.provider,
    marinadeState.msolMint,
    ownerAddress
  )

  if (createAssociateTokenInstruction) {
    instructions.push(createAssociateTokenInstruction)
  }

  const { duplicationFlag, validatorIndex } = await identifyValidatorFromTx(
    withdrawTx.instructions,
    program,
    marinadeState
  )

  const depositInstruction =
    await programBuilders.depositStakeAccountInstructionBuilder({
      validatorIndex,
      marinadeState,
      duplicationFlag,
      ownerAddress,
      stakeAccountAddress: withdrawTx.signers[1].publicKey,
      authorizedWithdrawerAddress: ownerAddress,
      associatedMSolTokenAccountAddress,
    })

  const liquidUnstakeInstruction = await liquidUnstakeInstructionBuilder({
    program,
    amountLamports: mSolAmountToReceive,
    marinadeState,
    ownerAddress,
    associatedMSolTokenAccountAddress,
  })
  instructions.push(depositInstruction)
  instructions.push(liquidUnstakeInstruction)

  const { blockhash: recentBlockhash } =
    await program.provider.connection.getLatestBlockhash('finalized')

  const transactionMessage = new web3.TransactionMessage({
    payerKey: ownerAddress,
    recentBlockhash,
    instructions,
  }).compileToV0Message([lookupTable])
  const transaction = new web3.VersionedTransaction(transactionMessage)
  transaction.sign(withdrawTx.signers)

  return {
    associatedMSolTokenAccountAddress,
    transaction,
  }
}
