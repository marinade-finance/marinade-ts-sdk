import { Provider, utils } from '@coral-xyz/anchor'
import {
  createAssociatedTokenAccountInstruction,
  getAccount,
  TokenError,
} from '@solana/spl-token'
import { ParsedStakeAccountInfo, ProcessedEpochInfo } from './anchor.types'
import {
  SystemProgram,
  Connection,
  PublicKey,
  TransactionInstruction,
  StakeProgram,
} from '@solana/web3.js'
import BN from 'bn.js'

export const SYSTEM_PROGRAM_ID = SystemProgram.programId
export const STAKE_PROGRAM_ID = StakeProgram.programId
export const U64_MAX = new BN('ffffffffffffffff', 16)

export function web3PubKeyOrNull(
  value: ConstructorParameters<typeof PublicKey>[0] | null
): PublicKey | null {
  return value === null ? null : new PublicKey(value)
}

export function BNOrNull(
  value: ConstructorParameters<typeof BN>[0] | null
): BN | null {
  return value === null ? null : new BN(value)
}

export async function getAssociatedTokenAccountAddress(
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  return utils.token.associatedAddress({ mint, owner })
}

export async function getOrCreateAssociatedTokenAccount(
  anchorProvider: Provider,
  mintAddress: PublicKey,
  ownerAddress: PublicKey,
  payerAddress?: PublicKey
): Promise<{
  associatedTokenAccountAddress: PublicKey
  createAssociateTokenInstruction: TransactionInstruction | null
}> {
  const existingTokenAccounts =
    await anchorProvider.connection.getTokenAccountsByOwner(ownerAddress, {
      mint: mintAddress,
    })
  const [existingTokenAccount] = existingTokenAccounts.value

  const associatedTokenAccountAddress =
    existingTokenAccount?.pubkey ??
    (await getAssociatedTokenAccountAddress(mintAddress, ownerAddress))
  let createAssociateTokenInstruction: TransactionInstruction | null = null

  try {
    await getAccount(anchorProvider.connection, associatedTokenAccountAddress)
  } catch (err) {
    if (
      !(err instanceof TokenError) ||
      err.name !== 'TokenAccountNotFoundError'
    ) {
      throw err
    }

    createAssociateTokenInstruction = createAssociatedTokenAccountInstruction(
      payerAddress ?? ownerAddress,
      associatedTokenAccountAddress,
      ownerAddress,
      mintAddress
    )
  }

  return {
    associatedTokenAccountAddress,
    createAssociateTokenInstruction,
  }
}

export async function getParsedStakeAccountInfo(
  providerOrConnection: Provider | Connection,
  stakeAccountAddress: PublicKey
): Promise<ParsedStakeAccountInfo> {
  const connection =
    providerOrConnection instanceof Connection
      ? providerOrConnection
      : providerOrConnection.connection
  const { value: stakeAccountInfo } = await connection.getParsedAccountInfo(
    stakeAccountAddress
  )

  if (!stakeAccountInfo) {
    throw new Error(
      `Failed to find the stake account ${stakeAccountAddress.toBase58()}`
    )
  }

  if (!stakeAccountInfo.owner.equals(STAKE_PROGRAM_ID)) {
    throw new Error(
      `${stakeAccountAddress.toBase58()} is not a stake account because owner is ${
        stakeAccountInfo.owner
      }`
    )
  }

  if (!stakeAccountInfo.data || stakeAccountInfo.data instanceof Buffer) {
    throw new Error('Failed to parse the stake account data')
  }

  const { parsed: parsedData } = stakeAccountInfo.data

  const activationEpoch = BNOrNull(
    parsedData?.info?.stake?.delegation?.activationEpoch ?? null
  )
  const deactivationEpoch = BNOrNull(
    parsedData?.info?.stake?.delegation?.deactivationEpoch ?? null
  )
  const lockup = parsedData?.info?.meta?.lockup
  const balanceLamports = BNOrNull(stakeAccountInfo.lamports)
  const stakedLamports = BNOrNull(
    parsedData?.info?.stake?.delegation.stake ?? null
  )
  const { epoch: currentEpoch } = await connection.getEpochInfo()
  const currentUnixTimestamp = Date.now() / 1000

  return {
    address: stakeAccountAddress,
    ownerAddress: stakeAccountInfo.owner,
    authorizedStakerAddress: web3PubKeyOrNull(
      parsedData?.info?.meta?.authorized?.staker ?? null
    ),
    authorizedWithdrawerAddress: web3PubKeyOrNull(
      parsedData?.info?.meta?.authorized?.withdrawer ?? null
    ),
    voterAddress: web3PubKeyOrNull(
      parsedData?.info?.stake?.delegation?.voter ?? null
    ),
    activationEpoch,
    deactivationEpoch,
    isCoolingDown: deactivationEpoch ? !deactivationEpoch.eq(U64_MAX) : false,
    isLockedUp:
      lockup?.custodian &&
      lockup?.custodian !== '' &&
      (lockup?.epoch > currentEpoch ||
        lockup?.unixTimestamp > currentUnixTimestamp),
    balanceLamports,
    stakedLamports,
  }
}

export async function getEpochInfo(
  connection: Connection
): Promise<ProcessedEpochInfo> {
  const epochInfo = await connection.getEpochInfo()
  const samples = await connection.getRecentPerformanceSamples(64)

  const sampleSlots = samples.reduce(
    (slots, sample) => sample.numSlots + slots,
    0
  )
  const sampleSeconds = samples.reduce(
    (seconds, sample) => sample.samplePeriodSecs + seconds,
    0
  )

  const avgSlotDuration = (sampleSeconds / sampleSlots) * 1000

  const slotsRemainingInEpoch = epochInfo.slotsInEpoch - epochInfo.slotIndex
  const msUntilEpochEnd = avgSlotDuration * slotsRemainingInEpoch
  const msElapsed = epochInfo.slotIndex * avgSlotDuration

  const epochProgress = (100 * epochInfo.slotIndex) / epochInfo.slotsInEpoch

  return {
    ...epochInfo,
    msUntilEpochEnd,
    msElapsed,
    epochProgress,
    avgSlotDuration,
    slotsRemainingInEpoch,
  }
}
