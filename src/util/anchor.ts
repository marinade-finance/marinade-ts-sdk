import { BN, Provider, web3 } from '@project-serum/anchor'
import * as anchor from '@project-serum/anchor'
import { AccountInfo, ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID, u64 } from '@solana/spl-token'
import { ParsedStakeAccountInfo } from './anchor.types'

export const SYSTEM_PROGRAM_ID = new web3.PublicKey('11111111111111111111111111111111')
export const STAKE_PROGRAM_ID = new web3.PublicKey('Stake11111111111111111111111111111111111111')
export const U64_MAX = new BN('ffffffffffffffff', 16)

export function web3PubKeyOrNull (value: ConstructorParameters<typeof web3.PublicKey>[0] | null): web3.PublicKey | null {
  return value === null ? null : new web3.PublicKey(value)
}

export function BNOrNull (value: ConstructorParameters<typeof BN>[0] | null): BN | null {
  return value === null ? null : new BN(value)
}

export function getMintClient (anchorProvider: Provider, mintAddress: web3.PublicKey): Token {
  return new Token(anchorProvider.connection, mintAddress, TOKEN_PROGRAM_ID, web3.Keypair.generate())
}

export async function getAssociatedTokenAccountAddress (mint: web3.PublicKey, owner: web3.PublicKey): Promise<web3.PublicKey> {
  return anchor.utils.token.associatedAddress({ mint, owner })
}

export async function getTokenAccountInfo (mintClient: Token, publicKey: web3.PublicKey): Promise<AccountInfo> {
  return mintClient.getAccountInfo(publicKey)
}

export async function getOrCreateAssociatedTokenAccount (anchorProvider: anchor.Provider, mintAddress: web3.PublicKey, ownerAddress: web3.PublicKey): Promise<{
  associatedTokenAccountAddress: web3.PublicKey
  createAssociateTokenInstruction: web3.TransactionInstruction | null
}> {
  const associatedTokenAccountAddress = await getAssociatedTokenAccountAddress(mintAddress, ownerAddress)
  let createAssociateTokenInstruction: web3.TransactionInstruction | null = null

  const mintClient = getMintClient(anchorProvider, mintAddress)

  try {
    await getTokenAccountInfo(mintClient, associatedTokenAccountAddress)
  } catch (err) {
    if (!(err instanceof Error) || err.message !== 'Failed to find account') {
      throw err
    }

    createAssociateTokenInstruction = Token.createAssociatedTokenAccountInstruction(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mintAddress,
      associatedTokenAccountAddress,
      ownerAddress,
      anchorProvider.wallet.publicKey
    )
  }

  return {
    associatedTokenAccountAddress,
    createAssociateTokenInstruction,
  }
}

export async function getParsedStakeAccountInfo (anchorProvider: anchor.Provider, stakeAccountAddress: web3.PublicKey): Promise<ParsedStakeAccountInfo> {
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