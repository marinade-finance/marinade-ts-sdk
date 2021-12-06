import { web3 } from '@project-serum/anchor'
import { web3PubKeyOrNull } from '../util'

const loadEnvVariable = (envVariableKey: string, defValue: string): string => process.env[envVariableKey] ?? defValue

const DEFAULT_PROVIDER_URL = 'https://api.devnet.solana.com'

export class MarinadeConfig {
  marinadeFinanceProgramId = new web3.PublicKey(loadEnvVariable('MARINADE_FINANCE_PROGRAM_ID', 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD'))
  marinadeReferralProgramId = new web3.PublicKey(loadEnvVariable('MARINADE_REFERRAL_PROGRAM_ID', 'mRefx8ypXNxE59NhoBqwqb3vTvjgf8MYECp4kgJWiDY'))

  marinadeStateAddress = new web3.PublicKey(loadEnvVariable('MARINADE_STATE_ADDRESS', '8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC'))
  marinadeReferralGlobalStateAddress = new web3.PublicKey(loadEnvVariable('MARINADE_REFERRAL_GLOBAL_STATE_ADDRESS', 'mRg6bDsAd5uwERAdNTynoUeRbqQsLa7yzuK2kkCUPGW'))

  stakeWithdrawAuthPDA = new web3.PublicKey(loadEnvVariable('STAKE_WITHDRAW_AUTH_PDA', '9eG63CdHjsfhHmobHgLtESGC8GabbmRcaSpHAZrtmhco'))

  connection = new web3.Connection(DEFAULT_PROVIDER_URL)
  publicKey: web3.PublicKey | null = null

  referralCode: web3.PublicKey | null = web3PubKeyOrNull(process.env['MARINADE_REFERRAL_CODE'] ?? null)

  constructor(configOverrides: Partial<MarinadeConfig> = {}) {
    Object.assign(this, configOverrides)
  }
}
