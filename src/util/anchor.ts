import { BN, Provider, utils, web3 } from '@coral-xyz/anchor'
import {
  createAssociatedTokenAccountInstruction,
  getAccount,
  TokenError,
} from '@solana/spl-token-3.x'
import { ParsedStakeAccountInfo, ProcessedEpochInfo } from './anchor.types'
import { Connection } from '@solana/web3.js'

export const SYSTEM_PROGRAM_ID = web3.SystemProgram.programId
export const STAKE_PROGRAM_ID = web3.StakeProgram.programId
export const U64_MAX = new BN('ffffffffffffffff', 16)

export function web3PubKeyOrNull(
  value: ConstructorParameters<typeof web3.PublicKey>[0] | null
): web3.PublicKey | null {
  return value === null ? null : new web3.PublicKey(value)
}

export function BNOrNull(
  value: ConstructorParameters<typeof BN>[0] | null
): BN | null {
  return value === null ? null : new BN(value)
}

export async function getAssociatedTokenAccountAddress(
  mint: web3.PublicKey,
  owner: web3.PublicKey
): Promise<web3.PublicKey> {
  return utils.token.associatedAddress({ mint, owner })
}

export async function getOrCreateAssociatedTokenAccount(
  anchorProvider: Provider,
  mintAddress: web3.PublicKey,
  ownerAddress: web3.PublicKey,
  payerAddress?: web3.PublicKey
): Promise<{
  associatedTokenAccountAddress: web3.PublicKey
  createAssociateTokenInstruction: web3.TransactionInstruction | null
}> {
  const existingTokenAccounts =
    await anchorProvider.connection.getTokenAccountsByOwner(ownerAddress, {
      mint: mintAddress,
    })
  const [existingTokenAccount] = existingTokenAccounts.value

  const associatedTokenAccountAddress =
    existingTokenAccount?.pubkey ??
    (await getAssociatedTokenAccountAddress(mintAddress, ownerAddress))
  let createAssociateTokenInstruction: web3.TransactionInstruction | null = null

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
  providerOrConnection: Provider | web3.Connection,
  stakeAccountAddress: web3.PublicKey
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

  if (
    !stakeAccountInfo.data ||
    stakeAccountInfo.data instanceof Buffer ||
    !('parsed' in stakeAccountInfo.data)
  ) {
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
  connection: web3.Connection
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
