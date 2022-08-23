import { BN, web3 } from '@project-serum/anchor'
import * as anchor from '@project-serum/anchor'
import { ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAccount, TokenAccountNotFoundError, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { ParsedStakeAccountInfo, ProcessedEpochInfo } from './anchor.types'

export const SYSTEM_PROGRAM_ID = new web3.PublicKey('11111111111111111111111111111111')
export const STAKE_PROGRAM_ID = new web3.PublicKey('Stake11111111111111111111111111111111111111')
export const U64_MAX = new BN('ffffffffffffffff', 16)

export function web3PubKeyOrNull(value: ConstructorParameters<typeof web3.PublicKey>[0] | null): web3.PublicKey | null {
  return value === null ? null : new web3.PublicKey(value)
}

export function BNOrNull(value: ConstructorParameters<typeof BN>[0] | null): BN | null {
  return value === null ? null : new BN(value)
}

export async function getAssociatedTokenAccountAddress(mint: web3.PublicKey, owner: web3.PublicKey): Promise<web3.PublicKey> {
  return anchor.utils.token.associatedAddress({ mint, owner })
}

export async function getOrCreateAssociatedTokenAccount(anchorProvider: anchor.Provider, mintAddress: web3.PublicKey, ownerAddress: web3.PublicKey, payerAddress?: web3.PublicKey): Promise<{
  associatedTokenAccountAddress: web3.PublicKey
  createAssociateTokenInstruction: web3.TransactionInstruction | null
}> {
  const existingTokenAccounts = await anchorProvider.connection.getTokenAccountsByOwner(ownerAddress, { mint: mintAddress })
  const [existingTokenAccount] = existingTokenAccounts.value

  const associatedTokenAccountAddress = existingTokenAccount?.pubkey ?? await getAssociatedTokenAccountAddress(mintAddress, ownerAddress)
  let createAssociateTokenInstruction: web3.TransactionInstruction | null = null

  try {
    await getAccount(anchorProvider.connection, associatedTokenAccountAddress)
  } catch (err) {
    if (!(err instanceof TokenAccountNotFoundError)) {
      throw err
    }

    createAssociateTokenInstruction = createAssociatedTokenAccountInstruction(
      payerAddress ?? ownerAddress,
      associatedTokenAccountAddress,
      ownerAddress,
      mintAddress,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    )
  }

  return {
    associatedTokenAccountAddress,
    createAssociateTokenInstruction,
  }
}

export async function getParsedStakeAccountInfo(anchorProvider: anchor.Provider, stakeAccountAddress: web3.PublicKey): Promise<ParsedStakeAccountInfo> {
  const { value: stakeAccountInfo } = await anchorProvider.connection.getParsedAccountInfo(stakeAccountAddress)

  if (!stakeAccountInfo) {
    throw new Error(`Failed to find the stake account ${stakeAccountAddress.toBase58()}`)
  }

  if (!stakeAccountInfo.owner.equals(STAKE_PROGRAM_ID)) {
    throw new Error(`${stakeAccountAddress.toBase58()} is not a stake account because owner is ${stakeAccountInfo.owner}`)
  }

  if (!stakeAccountInfo.data || stakeAccountInfo.data instanceof Buffer) {
    throw new Error('Failed to parse the stake account data')
  }

  const { parsed: parsedData } = stakeAccountInfo.data

  const activationEpoch = BNOrNull(parsedData?.info?.stake?.delegation?.activationEpoch ?? null)
  const deactivationEpoch = BNOrNull(parsedData?.info?.stake?.delegation?.deactivationEpoch ?? null)

  return {
    ownerAddress: stakeAccountInfo.owner,
    authorizedStakerAddress: web3PubKeyOrNull(parsedData?.info?.meta?.authorized?.staker ?? null),
    authorizedWithdrawerAddress: web3PubKeyOrNull(parsedData?.info?.meta?.authorized?.withdrawer ?? null),
    voterAddress: web3PubKeyOrNull(parsedData?.info?.stake?.delegation?.voter ?? null),
    activationEpoch,
    deactivationEpoch,
    isCoolingDown: deactivationEpoch ? !deactivationEpoch.eq(U64_MAX) : false,
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

  const avgSlotDuration = sampleSeconds / sampleSlots * 1000

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
