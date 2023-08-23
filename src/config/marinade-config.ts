import { web3 } from '@coral-xyz/anchor'

const DEFAULT_PROVIDER_URL = 'https://api.devnet.solana.com'

export const DEFAULT_MARINADE_PROGRAM_ID = new web3.PublicKey(
  'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD'
)
export const DEFAULT_MARINADE_REFERRAL_PROGRAM_ID = new web3.PublicKey(
  'MR2LqxoSbw831bNy68utpu5n4YqBH3AzDmddkgk9LQv'
)
export const DEFAULT_MARINADE_STATE_ADDRESS = new web3.PublicKey(
  '8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC'
)
export const DEFAULT_MARINADE_REFERRAL_GLOBAL_STATE_ADDRESS =
  new web3.PublicKey('MRSh4rUNrpn7mjAq9ENHV4rvwwPKMij113ScZq3twp2')
export const DEFAULT_STAKE_WITHDRAW_AUTH_PDA = new web3.PublicKey(
  '9eG63CdHjsfhHmobHgLtESGC8GabbmRcaSpHAZrtmhco'
)
export const LOOKUP_TABLE_ADDRESS = new web3.PublicKey(
  'DCcQeBaCiYsEsjjmEsSYPCr9o4n174LKqXNDvQT5wVd8'
)

export class MarinadeConfig {
  marinadeFinanceProgramId = DEFAULT_MARINADE_PROGRAM_ID
  marinadeReferralProgramId = DEFAULT_MARINADE_REFERRAL_PROGRAM_ID
  marinadeStateAddress = DEFAULT_MARINADE_STATE_ADDRESS
  marinadeReferralGlobalStateAddress =
    DEFAULT_MARINADE_REFERRAL_GLOBAL_STATE_ADDRESS
  stakeWithdrawAuthPDA = DEFAULT_STAKE_WITHDRAW_AUTH_PDA
  lookupTableAddress = LOOKUP_TABLE_ADDRESS

  connection = new web3.Connection(DEFAULT_PROVIDER_URL)
  publicKey: web3.PublicKey | null = null

  referralCode: web3.PublicKey | null = null

  constructor(configOverrides: Partial<MarinadeConfig> = {}) {
    Object.assign(this, configOverrides)
  }
}
