import { BN } from '@coral-xyz/anchor'
import { StakePool } from '@solana/spl-stake-pool'

const SOL_DECIMALS = 9

export function withDecimalPoint(bn: BN, decimals: number): string {
  const s = bn.toString().padStart(decimals + 1, '0')
  const l = s.length
  return s.slice(0, l - decimals) + '.' + s.slice(-decimals)
}

export function tokenBalanceToNumber(bn: BN, decimals: number): number {
  return Number(withDecimalPoint(bn, decimals))
}

export function lamportsToSol(bn: BN): number {
  return tokenBalanceToNumber(bn, SOL_DECIMALS)
}

export function solToLamports(amountSol: number): BN {
  return new BN(amountSol.toFixed(SOL_DECIMALS).replace('.', ''))
}

export function divideBnToNumber(numerator: BN, denominator: BN): number {
  if (denominator.isZero()) {
    return 0
  }
  const quotient = numerator.div(denominator).toNumber()
  const rem = numerator.umod(denominator)
  const gcd = rem.gcd(denominator)
  return quotient + rem.div(gcd).toNumber() / denominator.div(gcd).toNumber()
}

export function calcLamportsWithdrawAmount(
  stakePool: StakePool,
  poolTokens: BN
): number {
  const numerator = poolTokens.mul(stakePool.totalLamports)
  const denominator = stakePool.poolTokenSupply
  if (numerator.lt(denominator)) {
    return 0
  }
  return divideBnToNumber(numerator, denominator)
}
