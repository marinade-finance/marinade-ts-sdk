/* eslint-disable @typescript-eslint/no-explicit-any */
import BN from 'bn.js'
import { getStakePoolAccount } from '@solana/spl-stake-pool'
import { ValidatorAccount } from '@solana/spl-stake-pool/dist/utils'
import {
  Connection,
  PublicKey,
  PublicKeyInitData,
  SYSVAR_CLOCK_PUBKEY,
  StakeProgram,
  TransactionInstruction,
} from '@solana/web3.js'
import { getParsedStakeAccountInfo } from './anchor'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import {
  getValidatorRecords,
  validatorDuplicationFlag,
} from '../marinade-state/marinade-state'
import { calcLamportsWithdrawAmount, solToLamports } from './conversion'
import { MarinadeFinanceProgram } from '../programs/marinade-finance-program'
import { MarinadeState } from '../marinade-state/marinade-state.types'

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
  program: MarinadeFinanceProgram,
  state: MarinadeState
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
    StakeProgram.programId.toString(),
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
          program.provider.connection,
          new PublicKey(acc)
        )
        if (accountInfo.voterAddress)
          validatorAddress = accountInfo.voterAddress.toString()
      } catch {
        /* empty */
      }
    })
  )

  const duplicationFlag = validatorDuplicationFlag(
    state,
    new PublicKey(validatorAddress)
  )
  const { validatorRecords } = await getValidatorRecords(program, state)
  const validatorLookupIndex = validatorRecords.findIndex(
    ({ validatorAccount }) =>
      validatorAccount.equals(new PublicKey(validatorAddress))
  )
  const validatorIndex =
    validatorLookupIndex === -1
      ? state.validatorSystem.validatorList.count
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
