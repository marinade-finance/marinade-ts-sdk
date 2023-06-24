/* eslint-disable @typescript-eslint/no-explicit-any */
import { BN, Provider } from '@coral-xyz/anchor'
import { getStakePoolAccount } from '@solana/spl-stake-pool'
import { ValidatorAccount } from '@solana/spl-stake-pool/dist/utils'
import {
  Connection,
  PublicKey,
  PublicKeyInitData,
  SYSVAR_CLOCK_PUBKEY,
  TransactionInstruction,
} from '@solana/web3.js'
import { STAKE_PROGRAM_ID, getParsedStakeAccountInfo } from './anchor'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token-3.x'
import { MarinadeState } from '../marinade-state/marinade-state'
import { calcLamportsWithdrawAmount, solToLamports } from './conversion'

export async function computeExpectedSOL(
  amountToWithdraw: number,
  cxn: Connection,
  stakePoolTokenAddress: PublicKey
) {
  const stakePool = await getStakePoolAccount(cxn, stakePoolTokenAddress)
  const solValue = calcLamportsWithdrawAmount(
    stakePool.account.data,
    solToLamports(amountToWithdraw)
  )

  const withdrawalFee =
    solValue *
    (stakePool.account.data.stakeWithdrawalFee.numerator
      .mul(new BN(1e6))
      .div(stakePool.account.data.stakeWithdrawalFee.denominator)
      .toNumber() /
      1e6)

  return solValue - withdrawalFee
}

export async function computeLSTValueInSOL(
  amount: number,
  cxn: Connection,
  stakePoolTokenAddress: PublicKey
) {
  const stakePool = await getStakePoolAccount(cxn, stakePoolTokenAddress)
  const solValue = calcLamportsWithdrawAmount(
    stakePool.account.data,
    solToLamports(amount)
  )

  return solValue
}

export async function identifyValidatorFromTx(
  instructions: TransactionInstruction[],
  provider: Provider,
  marinadeState: MarinadeState
): Promise<{
  validatorAddress: PublicKey
  duplicationFlag: PublicKey
  validatorIndex: number
}> {
  const withdrawTxAccounts = instructions.flatMap(
    (i: { keys: { pubkey: { toString: () => any } }[] }) =>
      i.keys.map((k: { pubkey: { toString: () => any } }) =>
        k.pubkey.toString()
      )
  )

  const excludedAccounts = [
    SYSVAR_CLOCK_PUBKEY.toString(),
    STAKE_PROGRAM_ID.toString(),
    TOKEN_PROGRAM_ID.toString(),
  ]
  const uniqueAccounts = withdrawTxAccounts.filter(
    (value: any, index: any, self: string | any[]) => {
      return (
        self.indexOf(value) === index &&
        self.lastIndexOf(value) === index &&
        !excludedAccounts.includes(value)
      )
    }
  )

  let validatorAddress = ''
  await Promise.all(
    uniqueAccounts.map(async (acc: PublicKeyInitData) => {
      try {
        const accountInfo = await getParsedStakeAccountInfo(
          provider,
          new PublicKey(acc)
        )
        if (accountInfo.voterAddress)
          validatorAddress = accountInfo.voterAddress.toString()
      } catch {
        /* empty */
      }
    })
  )

  const duplicationFlag = await marinadeState.validatorDuplicationFlag(
    new PublicKey(validatorAddress)
  )
  const { validatorRecords } = await marinadeState.getValidatorRecords()
  const validatorLookupIndex = validatorRecords.findIndex(
    ({ validatorAccount }) =>
      validatorAccount.equals(new PublicKey(validatorAddress))
  )
  const validatorIndex =
    validatorLookupIndex === -1
      ? marinadeState.state.validatorSystem.validatorList.count
      : validatorLookupIndex

  return {
    validatorAddress: new PublicKey(validatorAddress),
    duplicationFlag,
    validatorIndex,
  }
}

export function selectSpecificValidator(
  a: ValidatorAccount,
  b: ValidatorAccount,
  validators: Set<string>
) {
  const scoredValidatorA = a.voteAddress
    ? validators.has(a.voteAddress.toString())
    : false
  const scoredValidatorB = b.voteAddress
    ? validators.has(b.voteAddress.toString())
    : false
  return (
    (scoredValidatorB ? b.lamports : 0) - (scoredValidatorA ? a.lamports : 0)
  )
}
