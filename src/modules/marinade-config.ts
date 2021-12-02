import { web3 } from '@project-serum/anchor'
import { web3PubKeyOrNull } from '../util'

const loadEnvVariable = (envVariableKey: string, defValue: string): string => process.env[envVariableKey] ?? defValue

export class MarinadeConfig {
  marinadeFinanceProgramId = new web3.PublicKey(loadEnvVariable('MARINADE_FINANCE_PROGRAM_ID', 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD'))
  marinadeReferralProgramId = new web3.PublicKey(loadEnvVariable('MARINADE_REFERRAL_PROGRAM_ID', 'FqYPYHc3man91xYDCugbGuDdWgkNLp5TvbXPascHW6MR'))

  marinadeStateAddress = new web3.PublicKey(loadEnvVariable('MARINADE_STATE_ADDRESS', '8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC'))
  // marinadeReferralStateAddress = new web3.PublicKey(loadEnvVariable('MARINADE_REFERRAL_STATE_ADDRESS', '8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC'))

  stakeWithdrawAuthPDA = new web3.PublicKey(loadEnvVariable('STAKE_WITHDRAW_AUTH_PDA', '9eG63CdHjsfhHmobHgLtESGC8GabbmRcaSpHAZrtmhco'))
  // anchorProviderUrl = loadEnvVariable('ANCHOR_PROVIDER_URL', 'https://api.mainnet-beta.solana.com')
  anchorProviderUrl = loadEnvVariable('ANCHOR_PROVIDER_URL', 'https://api.devnet.solana.com')
  wallet = web3.Keypair.generate()

  referralCode: web3.PublicKey | null = web3PubKeyOrNull(process.env['MARINADE_REFERRAL_CODE'] ?? null)

  constructor(configOverrides: Partial<MarinadeConfig> = {}) {
    Object.assign(this, configOverrides)
  }
}
