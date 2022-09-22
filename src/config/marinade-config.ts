import { web3 } from '@project-serum/anchor'

const DEFAULT_PROVIDER_URL = 'https://api.devnet.solana.com'

export class MarinadeConfig {
  marinadeFinanceProgramId = new web3.PublicKey('MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD')
  marinadeReferralProgramId = new web3.PublicKey('MR2LqxoSbw831bNy68utpu5n4YqBH3AzDmddkgk9LQv')

  marinadeStateAddress = new web3.PublicKey('8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC')
  marinadeReferralGlobalStateAddress = new web3.PublicKey('MRSh4rUNrpn7mjAq9ENHV4rvwwPKMij113ScZq3twp2')

  stakeWithdrawAuthPDA = new web3.PublicKey('9eG63CdHjsfhHmobHgLtESGC8GabbmRcaSpHAZrtmhco')

  connection = new web3.Connection(DEFAULT_PROVIDER_URL)
  publicKey: web3.PublicKey | null = null

  referralCode: web3.PublicKey | null = null

  constructor(configOverrides: Partial<MarinadeConfig> = {}) {
    Object.assign(this, configOverrides)
  }
}
