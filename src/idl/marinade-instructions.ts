import { BN, Program, web3 } from '@project-serum/anchor'
import { MarinadeFinanceIdl } from './marinade-finance-idl'
import { MarinadeReferralIdl } from './marinade-referral-idl'

export const addLiquidityInstruction = ({ program, accounts, amountLamports }: {
  program: Program,
  accounts: MarinadeFinanceIdl.Instruction.AddLiquidity.Accounts,
  amountLamports: BN,
}): web3.TransactionInstruction => program.instruction.addLiquidity(
  amountLamports,
  { accounts }
)
export const removeLiquidityInstruction = ({ program, accounts, amountLamports }: {
  program: Program,
  accounts: MarinadeFinanceIdl.Instruction.RemoveLiquidity.Accounts,
  amountLamports: BN,
}): web3.TransactionInstruction => program.instruction.removeLiquidity(
  amountLamports,
  { accounts }
)

export const depositInstruction = ({ program, accounts, amountLamports }: {
  program: Program,
  accounts: MarinadeFinanceIdl.Instruction.Deposit.Accounts,
  amountLamports: BN,
}): web3.TransactionInstruction => program.instruction.deposit(
  amountLamports,
  { accounts }
)

export const liquidUnstakeInstruction = ({ program, accounts, amountLamports }: {
  program: Program,
  accounts: MarinadeFinanceIdl.Instruction.LiquidUnstake.Accounts,
  amountLamports: BN,
}): web3.TransactionInstruction => program.instruction.liquidUnstake(
  amountLamports,
  { accounts }
)

export const depositStakeAccountInstruction = ({ program, accounts, validatorIndex }: {
  program: Program,
  accounts: MarinadeFinanceIdl.Instruction.DepositStakeAccount.Accounts,
  validatorIndex: number,
}): web3.TransactionInstruction => program.instruction.depositStakeAccountAccounts(
  validatorIndex,
  { accounts }
)
