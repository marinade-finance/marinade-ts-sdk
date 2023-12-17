/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  getOrCreateAssociatedTokenAccount,
  getParsedStakeAccountInfo,
} from './util/anchor'
import {
  DepositOptions,
  DepositStakeAccountOptions,
  MarinadeResult,
  ValidatorStats,
} from './marinade.types'
import {
  addLiquidityInstructionBuilder,
  claimInstructionBuilder,
  orderUnstakeInstructionBuilder,
  removeLiquidityInstructionBuilder,
} from './programs/marinade-finance-program'
import { TICKET_ACCOUNT_SIZE } from './marinade-state/borsh/ticket-account'
import {
  computeMsolAmount,
  ParsedStakeAccountInfo,
  proportionalBN,
} from './util'
import { withdrawStake } from '@solana/spl-stake-pool'
import {
  computeExpectedSOL,
  identifyValidatorFromTx,
  selectSpecificValidator,
} from './util/stake-pool-helpers'
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  StakeProgram,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js'
import {
  getValidatorRecords,
  validatorDuplicationFlag,
} from './marinade-state/marinade-state'
import BN from 'bn.js'
import {
  createDirectedStakeVoteIx,
  getDirectedStakeSdk,
} from './marinade-directed-stake'
import { MarinadeProgram } from './programs/marinade-program'
import {
  depositInstructionBuilder as marinadeDepositInstructionBuilder,
  liquidUnstakeInstructionBuilder as marinadeLiquidUnstakeInstructionBuilder,
  depositStakeAccountInstructionBuilder as marinadeDepositStakeAccountInstructionBuilder,
} from './programs/marinade-finance-program'
import {
  depositInstructionBuilder as referralDepositInstructionBuilder,
  liquidUnstakeInstructionBuilder as referralLiquidUnstakeInstructionBuilder,
  depositStakeAccountInstructionBuilder as referralDepositStakeAccountInstructionBuilder,
} from './programs/marinade-referral-program'
import { utils } from '@coral-xyz/anchor'

/**
 * Returns a transaction with the instructions to
 * Add liquidity to the liquidity pool and receive LP tokens
 *
 *
 * @param {BN} amountLamports - The amount of lamports added to the liquidity pool
 */
export async function addLiquidity(
  marinadeProgram: MarinadeProgram,
  ownerAddress: PublicKey,
  amountLamports: BN
): Promise<MarinadeResult.AddLiquidity> {
  const transaction = new Transaction()

  const {
    associatedTokenAccountAddress: associatedLPTokenAccountAddress,
    createAssociateTokenInstruction,
  } = await getOrCreateAssociatedTokenAccount(
    marinadeProgram.provider.connection,
    marinadeProgram.marinadeState.liqPool.lpMint,
    ownerAddress
  )

  if (createAssociateTokenInstruction) {
    transaction.add(createAssociateTokenInstruction)
  }

  const addLiquidityInstruction = await addLiquidityInstructionBuilder({
    program: marinadeProgram.program,
    marinadeState: marinadeProgram.marinadeState,
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
export async function removeLiquidity(
  marinadeProgram: MarinadeProgram,
  ownerAddress: PublicKey,
  amountLamports: BN
): Promise<MarinadeResult.RemoveLiquidity> {
  const transaction = new Transaction()

  const associatedLPTokenAccountAddress = utils.token.associatedAddress({
    mint: marinadeProgram.marinadeState.liqPool.lpMint,
    owner: ownerAddress,
  })

  const {
    associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
    createAssociateTokenInstruction,
  } = await getOrCreateAssociatedTokenAccount(
    marinadeProgram.provider.connection,
    marinadeProgram.marinadeState.msolMint,
    ownerAddress
  )

  if (createAssociateTokenInstruction) {
    transaction.add(createAssociateTokenInstruction)
  }

  const removeLiquidityInstruction = await removeLiquidityInstructionBuilder({
    program: marinadeProgram.program,
    marinadeState: marinadeProgram.marinadeState,
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
 * Returns a transaction with the instructions to
 * Stake SOL in exchange for mSOL
 *
 * // TODO: params are wrongly documented here
 * @param {MarinadeReferralProgram} referralProgram - Marinade Referral Program
 * @param {BN} amountLamports - The amount lamports staked
 * @param {DepositOptions} options - Additional deposit options
 */
export async function deposit(
  marinadeProgram: MarinadeProgram,
  ownerAddress: PublicKey,
  amountLamports: BN,
  options: DepositOptions = {}
): Promise<MarinadeResult.Deposit> {
  const feePayer = ownerAddress
  const mintToOwnerAddress = options.mintToOwnerAddress ?? ownerAddress
  const transaction = new Transaction()

  const {
    associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
    createAssociateTokenInstruction,
  } = await getOrCreateAssociatedTokenAccount(
    marinadeProgram.provider.connection,
    marinadeProgram.marinadeState.msolMint,
    mintToOwnerAddress,
    feePayer
  )

  if (createAssociateTokenInstruction) {
    transaction.add(createAssociateTokenInstruction)
  }

  let depositInstruction: TransactionInstruction
  if (marinadeProgram.isReferralProgram()) {
    depositInstruction = await referralDepositInstructionBuilder({
      program: marinadeProgram.referralProgram,
      amountLamports,
      marinadeState: marinadeProgram.marinadeState,
      referralState: marinadeProgram.referralState,
      transferFrom: feePayer,
      associatedMSolTokenAccountAddress,
    })
  } else {
    depositInstruction = await marinadeDepositInstructionBuilder({
      program: marinadeProgram.program,
      amountLamports,
      marinadeState: marinadeProgram.marinadeState,
      transferFrom: feePayer,
      associatedMSolTokenAccountAddress,
    })
  }

  transaction.add(depositInstruction)

  const directedStakeSdk = getDirectedStakeSdk(
    marinadeProgram.provider.connection,
    ownerAddress
  )
  const directedStakeInstruction = await createDirectedStakeVoteIx(
    directedStakeSdk,
    options.directToValidatorVoteAddress
  )
  if (directedStakeInstruction) {
    transaction.add(directedStakeInstruction)
  }

  return {
    associatedMSolTokenAccountAddress,
    transaction,
  }
}

/**
 * ⚠️ WARNING ⚠️ The liquidity in the pool for this swap is typically low,
 * which can result in high transaction fees. It is advisable to consider
 * Jup swap API or proceed with caution.
 *
 * Returns a transaction with the instructions to
 * Swap your mSOL to get back SOL immediately using the liquidity pool
 *
 *
 * @param {BN} amountLamports - The amount of mSOL exchanged for SOL
 */
export async function liquidUnstake(
  marinadeProgram: MarinadeProgram,
  ownerAddress: PublicKey,
  amountLamports: BN,
  associatedMSolTokenAccountAddress?: PublicKey
): Promise<MarinadeResult.LiquidUnstake> {
  const transaction = new Transaction()

  if (!associatedMSolTokenAccountAddress) {
    const associatedTokenAccountInfos = await getOrCreateAssociatedTokenAccount(
      marinadeProgram.provider.connection,
      marinadeProgram.marinadeState.msolMint,
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

  let liquidUnstakeInstruction: TransactionInstruction
  if (marinadeProgram.isReferralProgram()) {
    liquidUnstakeInstruction = await referralLiquidUnstakeInstructionBuilder({
      program: marinadeProgram.referralProgram,
      marinadeState: marinadeProgram.marinadeState,
      referralState: marinadeProgram.referralState,
      amountLamports,
      ownerAddress,
      associatedMSolTokenAccountAddress,
    })
  } else {
    liquidUnstakeInstruction = await marinadeLiquidUnstakeInstructionBuilder({
      program: marinadeProgram.program,
      marinadeState: marinadeProgram.marinadeState,
      amountLamports,
      ownerAddress,
      associatedMSolTokenAccountAddress,
    })
  }

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
 * @param {PublicKey} stakeAccountAddress - The account to be deposited
 * @param {DepositStakeAccountOptions} options - Additional deposit options
 */
export async function depositStakeAccount(
  marinadeProgram: MarinadeProgram,
  ownerAddress: PublicKey,
  stakeAccountAddress: PublicKey,
  options: DepositStakeAccountOptions = {}
): Promise<MarinadeResult.DepositStakeAccount> {
  const stakeAccountInfo = await getParsedStakeAccountInfo(
    marinadeProgram.provider.connection,
    stakeAccountAddress
  )
  const rent =
    await marinadeProgram.provider.connection.getMinimumBalanceForRentExemption(
      StakeProgram.space
    )

  return depositStakeAccountByAccount(
    marinadeProgram,
    ownerAddress,
    stakeAccountInfo,
    rent,
    options
  )
}

/**
 * @beta
 *
 * Returns a transaction with the instructions to
 * Deposit a deactivating stake account.
 * Note that the stake must be deactivating and the validator must be known to Marinade
 *
 *
 * @param {PublicKey} stakeAccountAddress - The account to be deposited
 * @param {DepositStakeAccountOptions} options - Additional deposit options
 */
export async function depositDeactivatingStakeAccount(
  marinadeProgram: MarinadeProgram,
  ownerAddress: PublicKey,
  stakeAccountAddress: PublicKey,
  options: DepositStakeAccountOptions = {}
): Promise<MarinadeResult.DepositDeactivatingStakeAccount> {
  const stakeAccountInfo = await getParsedStakeAccountInfo(
    marinadeProgram.provider.connection,
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
    marinadeProgram.provider.connection,
    marinadeProgram.marinadeState.msolMint,
    ownerAddress
  )

  if (createAssociateTokenInstruction) {
    delegateTransaction.instructions.push(createAssociateTokenInstruction)
  }

  const duplicationFlag = validatorDuplicationFlag(
    marinadeProgram.marinadeState,
    stakeAccountInfo.voterAddress
  )
  const { validatorRecords } = await getValidatorRecords(
    marinadeProgram.program,
    marinadeProgram.marinadeState
  )
  const validatorLookupIndex = validatorRecords.findIndex(
    ({ validatorAccount }) =>
      validatorAccount.equals(stakeAccountInfo.voterAddress!)
  )
  const validatorIndex =
    validatorLookupIndex === -1
      ? marinadeProgram.marinadeState.validatorSystem.validatorList.count
      : validatorLookupIndex

  // TODO: should this be via referral program as well or not at all?
  let depositInstruction: TransactionInstruction
  if (marinadeProgram.isReferralProgram()) {
    depositInstruction = await referralDepositStakeAccountInstructionBuilder({
      program: marinadeProgram.referralProgram,
      marinadeState: marinadeProgram.marinadeState,
      referralState: marinadeProgram.referralState,
      validatorIndex,
      duplicationFlag,
      ownerAddress,
      stakeAccountAddress,
      authorizedWithdrawerAddress: ownerAddress,
      associatedMSolTokenAccountAddress,
    })
  } else {
    depositInstruction = await marinadeDepositStakeAccountInstructionBuilder({
      program: marinadeProgram.program,
      marinadeState: marinadeProgram.marinadeState,
      validatorIndex,
      duplicationFlag,
      ownerAddress,
      stakeAccountAddress,
      authorizedWithdrawerAddress: ownerAddress,
      associatedMSolTokenAccountAddress,
    })
  }

  delegateTransaction.instructions.push(depositInstruction)

  const directedStakeSdk = getDirectedStakeSdk(
    marinadeProgram.provider.connection,
    ownerAddress
  )
  const directedStakeInstruction = await createDirectedStakeVoteIx(
    directedStakeSdk,
    options.directToValidatorVoteAddress
  )
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
 * @param {MarinadeState} state - Marinade State needed for retrieving validator info
 * @param {ParsedStakeAccountInfo} stakeAccountInfo - Parsed Stake Account info
 * @param {number} rent - Rent needed for a stake account
 * @param {DepositStakeAccountOptions} options - Additional deposit options
 */
export async function depositStakeAccountByAccount(
  marinadeProgram: MarinadeProgram,
  ownerAddress: PublicKey,
  stakeAccountInfo: ParsedStakeAccountInfo,
  rent: number,
  options: DepositStakeAccountOptions = {}
): Promise<MarinadeResult.DepositStakeAccount> {
  const transaction = new Transaction()
  const currentEpoch = await marinadeProgram.provider.connection.getEpochInfo()

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
      StakeProgram.delegate({
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
        StakeProgram.withdraw({
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

  const { validatorRecords } = await getValidatorRecords(
    marinadeProgram.program,
    marinadeProgram.marinadeState
  )
  const validatorLookupIndex = validatorRecords.findIndex(
    ({ validatorAccount }) => validatorAccount.equals(voterAddress)
  )
  const validatorIndex =
    validatorLookupIndex === -1
      ? marinadeProgram.marinadeState.validatorSystem.validatorList.count
      : validatorLookupIndex

  const duplicationFlag = validatorDuplicationFlag(
    marinadeProgram.marinadeState,
    voterAddress
  )

  const {
    associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
    createAssociateTokenInstruction,
  } = await getOrCreateAssociatedTokenAccount(
    marinadeProgram.provider.connection,
    marinadeProgram.marinadeState.msolMint,
    ownerAddress
  )

  if (createAssociateTokenInstruction) {
    transaction.add(createAssociateTokenInstruction)
  }

  let depositStakeAccountInstruction: TransactionInstruction
  if (marinadeProgram.isReferralProgram()) {
    depositStakeAccountInstruction =
      await referralDepositStakeAccountInstructionBuilder({
        program: marinadeProgram.referralProgram,
        marinadeState: marinadeProgram.marinadeState,
        referralState: marinadeProgram.referralState,
        validatorIndex,
        duplicationFlag,
        authorizedWithdrawerAddress,
        associatedMSolTokenAccountAddress,
        ownerAddress,
        stakeAccountAddress: stakeAccountInfo.address,
      })
  } else {
    depositStakeAccountInstruction =
      await marinadeDepositStakeAccountInstructionBuilder({
        program: marinadeProgram.program,
        marinadeState: marinadeProgram.marinadeState,
        validatorIndex,
        duplicationFlag,
        authorizedWithdrawerAddress,
        associatedMSolTokenAccountAddress,
        ownerAddress,
        stakeAccountAddress: stakeAccountInfo.address,
      })
  }

  transaction.add(depositStakeAccountInstruction)

  const directedStakeSdk = getDirectedStakeSdk(
    marinadeProgram.provider.connection,
    ownerAddress
  )
  const directedStakeInstruction = await createDirectedStakeVoteIx(
    directedStakeSdk,
    options.directToValidatorVoteAddress
  )
  if (directedStakeInstruction) {
    transaction.add(directedStakeInstruction)
  }

  return {
    associatedMSolTokenAccountAddress,
    voterAddress,
    transaction,
    mintRatio: marinadeProgram.marinadeState.msolPrice.toNumber(),
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
 * @param {PublicKey} stakeAccountAddress - The account to be deposited
 * @param {BN} solToKeep - Amount of SOL lamports to keep
 * @param {DepositStakeAccountOptions} options - Additional deposit options
 */
export async function partiallyDepositStakeAccount(
  marinadeProgram: MarinadeProgram,
  ownerAddress: PublicKey,
  stakeAccountAddress: PublicKey,
  solToKeep: BN,
  options: DepositStakeAccountOptions = {}
): Promise<MarinadeResult.PartiallyDepositStakeAccount> {
  const stakeAccountInfo = await getParsedStakeAccountInfo(
    marinadeProgram.provider.connection,
    stakeAccountAddress
  )

  if (
    stakeAccountInfo.balanceLamports &&
    stakeAccountInfo.balanceLamports?.sub(solToKeep).toNumber() < 1
  ) {
    throw new Error("Can't deposit less than 1 SOL")
  }

  const rent =
    await marinadeProgram.provider.connection.getMinimumBalanceForRentExemption(
      StakeProgram.space
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
  } = await depositStakeAccountByAccount(
    marinadeProgram,
    ownerAddress,
    stakeAccountInfo,
    rent,
    options
  )

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
 * @param {PublicKey} stakeAccountAddress - The account to be deposited
 * @param {BN} solToKeep - Amount of SOL lamports to keep as a stake account
 * @param {DepositStakeAccountOptions} options - Additional deposit options
 */
export async function depositActivatingStakeAccount(
  marinadeProgram: MarinadeProgram,
  ownerAddress: PublicKey,
  stakeAccountAddress: PublicKey,
  solToKeep: BN,
  options: DepositStakeAccountOptions = {}
): Promise<MarinadeResult.PartiallyDepositStakeAccount> {
  const stakeAccountInfo = await getParsedStakeAccountInfo(
    marinadeProgram.provider.connection,
    stakeAccountAddress
  )

  if (!stakeAccountInfo.stakedLamports) {
    throw new Error(
      `Stake account ${stakeAccountInfo.address} does not have staked lamports`
    )
  }

  const rent =
    await marinadeProgram.provider.connection.getMinimumBalanceForRentExemption(
      StakeProgram.space
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
    await deposit(marinadeProgram, ownerAddress, lamportsToWithdraw, {
      directToValidatorVoteAddress: options.directToValidatorVoteAddress,
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
 * @param {PublicKey} stakeAccountAddress - The account to be deposited
 * @param {BN} mSolToKeep - Optional amount of mSOL lamports to keep
 */
export async function liquidateStakeAccount(
  marinadeProgram: MarinadeProgram,
  ownerAddress: PublicKey,
  stakeAccountAddress: PublicKey,
  mSolToKeep?: BN
): Promise<MarinadeResult.LiquidateStakeAccount> {
  const stakeAccountInfo = await getParsedStakeAccountInfo(
    marinadeProgram.provider.connection,
    stakeAccountAddress
  )
  const rent =
    await marinadeProgram.provider.connection.getMinimumBalanceForRentExemption(
      StakeProgram.space
    )

  const {
    transaction: depositTx,
    associatedMSolTokenAccountAddress,
    voterAddress,
  } = await depositStakeAccountByAccount(
    marinadeProgram,
    ownerAddress,
    stakeAccountInfo,
    rent
  )

  let mSolAmountToReceive = computeMsolAmount(
    stakeAccountInfo.stakedLamports ?? new BN(0),
    marinadeProgram.marinadeState
  )
  // when working with referral partner the costs of the deposit operation is subtracted
  //  from the mSOL amount the user receives
  if (marinadeProgram.isReferralProgram()) {
    const partnerOperationFee =
      marinadeProgram.referralState.operationDepositStakeAccountFee
    mSolAmountToReceive = mSolAmountToReceive.sub(
      proportionalBN(
        mSolAmountToReceive,
        new BN(partnerOperationFee),
        new BN(10_000)
      )
    )
  }

  const unstakeAmountMSol = mSolAmountToReceive.sub(mSolToKeep ?? new BN(0))
  const { transaction: unstakeTx } = await liquidUnstake(
    marinadeProgram,
    ownerAddress,
    unstakeAmountMSol,
    associatedMSolTokenAccountAddress
  )

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
 * @param {PublicKey} stakeAccountAddress - The account to be deposited
 * @param {BN} solToKeep - Amount of SOL lamports to keep
 */
export async function partiallyLiquidateStakeAccount(
  marinadeProgram: MarinadeProgram,
  ownerAddress: PublicKey,
  stakeAccountAddress: PublicKey,
  solToKeep: BN
): Promise<MarinadeResult.PartiallyDepositStakeAccount> {
  const stakeAccountInfo = await getParsedStakeAccountInfo(
    marinadeProgram.provider.connection,
    stakeAccountAddress
  )

  const rent =
    await marinadeProgram.provider.connection.getMinimumBalanceForRentExemption(
      StakeProgram.space
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
  } = await depositStakeAccountByAccount(
    marinadeProgram,
    ownerAddress,
    stakeAccountInfo,
    rent
  )

  depositTx.instructions.unshift(...splitStakeInstruction.instructions)

  let mSolAmountToReceive = computeMsolAmount(
    stakeToLiquidate,
    marinadeProgram.marinadeState
  )
  // when working with referral partner the costs of the deposit operation is subtracted from the mSOL amount the user receives
  if (marinadeProgram.isReferralProgram()) {
    const partnerOperationFee =
      marinadeProgram.referralState.operationDepositStakeAccountFee
    mSolAmountToReceive = mSolAmountToReceive.sub(
      proportionalBN(
        mSolAmountToReceive,
        new BN(partnerOperationFee),
        new BN(10_000)
      )
    )
  }

  const { transaction: unstakeTx } = await liquidUnstake(
    marinadeProgram,
    ownerAddress,
    mSolAmountToReceive,
    associatedMSolTokenAccountAddress
  )

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
  marinadeProgram: MarinadeProgram,
  ownerAddress: PublicKey,
  msolAmount: BN
): Promise<MarinadeResult.OrderUnstake> {
  const associatedMSolTokenAccountAddress = utils.token.associatedAddress({
    mint: marinadeProgram.marinadeState.msolMint,
    owner: ownerAddress,
  })
  const ticketAccountKeypair = Keypair.generate()
  const rent =
    await marinadeProgram.provider.connection.getMinimumBalanceForRentExemption(
      TICKET_ACCOUNT_SIZE
    )
  const createAccountInstruction = SystemProgram.createAccount({
    fromPubkey: ownerAddress,
    newAccountPubkey: ticketAccountKeypair.publicKey,
    lamports: rent,
    space: TICKET_ACCOUNT_SIZE,
    programId: marinadeProgram.program.programId,
  })

  const orderUnstakeInstruction = await orderUnstakeInstructionBuilder({
    program: marinadeProgram.program,
    marinadeState: marinadeProgram.marinadeState,
    msolAmount,
    ownerAddress,
    associatedMSolTokenAccountAddress,
    newTicketAccount: ticketAccountKeypair.publicKey,
  })

  const transaction = new Transaction().add(
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
 * @param {PublicKey} ticketAccount - Address of the ticket account for SOLs being claimed from
 */
export async function claim(
  marinadeProgram: MarinadeProgram,
  ownerAddress: PublicKey,
  ticketAccount: PublicKey
): Promise<MarinadeResult.Claim> {
  const claimInstruction = await claimInstructionBuilder({
    program: marinadeProgram.program,
    marinadeState: marinadeProgram.marinadeState,
    ticketAccount,
    transferSolTo: ownerAddress,
  })

  const transaction = new Transaction().add(claimInstruction)

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
 * @param {PublicKey} stakePoolTokenAddress - The stake pool token account to be deposited
 * @param {number} amountToDeposit - Amount to deposit
 * @param {ValidatorStats[]} validators - List of validators to prioritize where to take the stake from
 */
export async function depositStakePoolToken(
  marinadeProgram: MarinadeProgram,
  ownerAddress: PublicKey,
  lookupTableAddress: PublicKey,
  stakePoolTokenAddress: PublicKey,
  amountToDeposit: number,
  validators: ValidatorStats[],
  options: DepositOptions = {}
): Promise<MarinadeResult.LiquidateStakePoolToken> {
  const lookupTable = (
    await marinadeProgram.provider.connection.getAddressLookupTable(
      lookupTableAddress
    )
  ).value
  if (!lookupTable) {
    throw new Error('Failed to load the lookup table')
  }

  const expectedSOL = await computeExpectedSOL(
    amountToDeposit,
    marinadeProgram.provider.connection,
    stakePoolTokenAddress
  )

  // Due to our contract 1 SOL limit for Stake accounts we can't accept less than equivalent of 1 SOL
  if (expectedSOL / LAMPORTS_PER_SOL < 1) {
    throw new Error("Can't convert less than equivalent of 1 SOL")
  }

  const instructions: TransactionInstruction[] = []

  const validatorSet = new Set(
    validators.filter(v => v.score).map(v => v.vote_account)
  )
  const withdrawTx = await withdrawStake(
    marinadeProgram.provider.connection,
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
    marinadeProgram.provider.connection,
    marinadeProgram.marinadeState.msolMint,
    ownerAddress
  )

  if (createAssociateTokenInstruction) {
    instructions.push(createAssociateTokenInstruction)
  }

  const { duplicationFlag, validatorIndex } = await identifyValidatorFromTx(
    withdrawTx.instructions,
    marinadeProgram.program,
    marinadeProgram.marinadeState
  )

  let depositInstruction: TransactionInstruction
  if (marinadeProgram.isReferralProgram()) {
    depositInstruction = await referralDepositStakeAccountInstructionBuilder({
      program: marinadeProgram.referralProgram,
      marinadeState: marinadeProgram.marinadeState,
      referralState: marinadeProgram.referralState,
      validatorIndex,
      duplicationFlag,
      ownerAddress,
      stakeAccountAddress: withdrawTx.signers[1].publicKey,
      authorizedWithdrawerAddress: ownerAddress,
      associatedMSolTokenAccountAddress,
    })
  } else {
    depositInstruction = await marinadeDepositStakeAccountInstructionBuilder({
      program: marinadeProgram.program,
      marinadeState: marinadeProgram.marinadeState,
      validatorIndex,
      duplicationFlag,
      ownerAddress,
      stakeAccountAddress: withdrawTx.signers[1].publicKey,
      authorizedWithdrawerAddress: ownerAddress,
      associatedMSolTokenAccountAddress,
    })
  }

  instructions.push(depositInstruction)

  const directedStakeSdk = getDirectedStakeSdk(
    marinadeProgram.provider.connection,
    ownerAddress
  )
  const directedStakeInstruction = await createDirectedStakeVoteIx(
    directedStakeSdk,
    options.directToValidatorVoteAddress
  )
  if (directedStakeInstruction) {
    instructions.push(directedStakeInstruction)
  }

  const { blockhash: recentBlockhash } =
    await marinadeProgram.provider.connection.getLatestBlockhash('finalized')

  const transactionMessage = new TransactionMessage({
    payerKey: ownerAddress,
    recentBlockhash,
    instructions,
  }).compileToV0Message([lookupTable])
  const transaction = new VersionedTransaction(transactionMessage)
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
 * @param {PublicKey} stakePoolTokenAddress - The stake pool token account to be liquidated
 * @param {number} amountToLiquidate - Amount to liquidate
 * @param {ValidatorStats[]} validators - List of validators to prioritize where to take the stake from
 */
export async function liquidateStakePoolToken(
  marinadeProgram: MarinadeProgram,
  ownerAddress: PublicKey,
  lookupTableAddress: PublicKey,
  stakePoolTokenAddress: PublicKey,
  amountToLiquidate: number,
  validators: ValidatorStats[]
): Promise<MarinadeResult.LiquidateStakePoolToken> {
  const lookupTable = (
    await marinadeProgram.provider.connection.getAddressLookupTable(
      lookupTableAddress
    )
  ).value
  if (!lookupTable) {
    throw new Error('Failed to load the lookup table')
  }

  const instructions: TransactionInstruction[] = []

  const validatorSet = new Set(
    validators.filter(v => v.score).map(v => v.vote_account)
  )
  const withdrawTx = await withdrawStake(
    marinadeProgram.provider.connection,
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
    marinadeProgram.provider.connection,
    stakePoolTokenAddress
  )

  // Due to our contract 1 SOL limit for Stake accounts we can't accept less than equivalent of 1 SOL
  if (expectedSOL / LAMPORTS_PER_SOL < 1) {
    throw new Error("Can't convert less than equivalent of 1 SOL")
  }

  let mSolAmountToReceive = computeMsolAmount(
    new BN(expectedSOL),
    marinadeProgram.marinadeState
  )
  // when working with referral partner the costs of the deposit operation is subtracted from the mSOL amount the user receives
  if (marinadeProgram.isReferralProgram()) {
    const partnerOperationFee =
      marinadeProgram.referralState.operationDepositStakeAccountFee
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
    marinadeProgram.provider.connection,
    marinadeProgram.marinadeState.msolMint,
    ownerAddress
  )

  if (createAssociateTokenInstruction) {
    instructions.push(createAssociateTokenInstruction)
  }

  const { duplicationFlag, validatorIndex } = await identifyValidatorFromTx(
    withdrawTx.instructions,
    marinadeProgram.program,
    marinadeProgram.marinadeState
  )

  let depositInstruction: TransactionInstruction
  if (marinadeProgram.isReferralProgram()) {
    depositInstruction = await referralDepositStakeAccountInstructionBuilder({
      program: marinadeProgram.referralProgram,
      marinadeState: marinadeProgram.marinadeState,
      referralState: marinadeProgram.referralState,
      validatorIndex,
      duplicationFlag,
      ownerAddress,
      stakeAccountAddress: withdrawTx.signers[1].publicKey,
      authorizedWithdrawerAddress: ownerAddress,
      associatedMSolTokenAccountAddress,
    })
  } else {
    depositInstruction = await marinadeDepositStakeAccountInstructionBuilder({
      program: marinadeProgram.program,
      marinadeState: marinadeProgram.marinadeState,
      validatorIndex,
      duplicationFlag,
      ownerAddress,
      stakeAccountAddress: withdrawTx.signers[1].publicKey,
      authorizedWithdrawerAddress: ownerAddress,
      associatedMSolTokenAccountAddress,
    })
  }

  let liquidUnstakeInstruction: TransactionInstruction
  if (marinadeProgram.isReferralProgram()) {
    liquidUnstakeInstruction = await referralLiquidUnstakeInstructionBuilder({
      program: marinadeProgram.referralProgram,
      marinadeState: marinadeProgram.marinadeState,
      referralState: marinadeProgram.referralState,
      amountLamports: mSolAmountToReceive,
      ownerAddress,
      associatedMSolTokenAccountAddress,
    })
  } else {
    liquidUnstakeInstruction = await marinadeLiquidUnstakeInstructionBuilder({
      program: marinadeProgram.program,
      marinadeState: marinadeProgram.marinadeState,
      amountLamports: mSolAmountToReceive,
      ownerAddress,
      associatedMSolTokenAccountAddress,
    })
  }
  instructions.push(depositInstruction)
  instructions.push(liquidUnstakeInstruction)

  const { blockhash: recentBlockhash } =
    await marinadeProgram.provider.connection.getLatestBlockhash('finalized')

  const transactionMessage = new TransactionMessage({
    payerKey: ownerAddress,
    recentBlockhash,
    instructions,
  }).compileToV0Message([lookupTable])
  const transaction = new VersionedTransaction(transactionMessage)
  transaction.sign(withdrawTx.signers)

  return {
    associatedMSolTokenAccountAddress,
    transaction,
  }
}
