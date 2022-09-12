import { web3 } from '@project-serum/anchor'

const DEFAULT_PROVIDER_URL = 'https://api.devnet.solana.com'

export class MarinadeConfig {
  marinadeFinanceProgramId = new web3.PublicKey('MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD')
  marinadeReferralProgramId = new web3.PublicKey('mRefx8ypXNxE59NhoBqwqb3vTvjgf8MYECp4kgJWiDY')

  // marinade instance public key
  marinadeStateAddress = new web3.PublicKey('8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC')

  marinadeReferralGlobalStateAddress = new web3.PublicKey('mRg6bDsAd5uwERAdNTynoUeRbqQsLa7yzuK2kkCUPGW')

  stakeWithdrawAuthPDA = new web3.PublicKey('9eG63CdHjsfhHmobHgLtESGC8GabbmRcaSpHAZrtmhco')

  connection = new web3.Connection(DEFAULT_PROVIDER_URL)
  publicKey: web3.PublicKey | null = null

  // referral PDA state account
  referralCode: web3.PublicKey | null = null
  // partner associated token account (ATA)
  tokenPartnerAccount: web3.PublicKey | null = null

  constructor(configOverrides: Partial<MarinadeConfig> = {}) {
    Object.assign(this, configOverrides)
  }
}
