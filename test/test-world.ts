import { BN, Provider, Wallet, web3 } from '@project-serum/anchor'
import { MarinadeUtils } from '../src'

export const LAMPORTS_AIRDROP_CAP = MarinadeUtils.solToLamports(2)

export const SDK_USER = web3.Keypair.fromSecretKey(new Uint8Array([
  120,  45, 242,  38,  63, 135,  84, 226,  66,  56,  76,
  216, 125, 144,  38, 182,  53,  47, 169, 251, 128,  65,
  185, 237,  41,  47,  64,  53, 158, 124,  64,   2, 132,
  229, 176, 107,  25, 190,  28, 223,  58, 136,  95, 237,
  236, 176,  26, 160,  11,  12, 131, 129,  21,   8, 221,
  100, 249, 221, 177, 114, 143, 231, 102, 250,
]))
// export const SDK_USER = Wallet.local().payer
// export const SDK_USER = new web3.Keypair()
console.log('SDK User', SDK_USER.publicKey.toBase58())

export const PROVIDER_URL = 'https://api.devnet.solana.com'
export const CONNECTION = new web3.Connection(PROVIDER_URL)
export const PROVIDER = new Provider(
  CONNECTION,
  new Wallet(SDK_USER),
  { commitment: 'confirmed'/*, skipPreflight: true*/ },
)

export const REFERRAL_CODE = new web3.PublicKey('mRtnRH2M3rMLP4BBcrxkk4WBKsSi3JvoyUEog7gf3qE')
export const PARTNER_NAME = 'REF_TEST'
console.log('Referral partner', PARTNER_NAME, REFERRAL_CODE.toBase58())

export const airdrop = async(to: web3.PublicKey, amountLamports: number) => {
  const signature = await PROVIDER.connection.requestAirdrop(to, amountLamports)
  await PROVIDER.connection.confirmTransaction(signature)
  console.log('Airdrop:', MarinadeUtils.lamportsToSol(new BN(amountLamports)), 'SOL', 'to', to.toBase58())
}

export const getBalanceLamports = async(account: web3.PublicKey) => PROVIDER.connection.getBalance(account)

export const provideMinimumLamportsBalance = async(account: web3.PublicKey, minimumLamportsBalance: BN) => {
  const balanceLamports = new BN(await getBalanceLamports(account))
  if (balanceLamports.gte(minimumLamportsBalance)) {
    return
  }

  let remainingLamportsToAirdrop = minimumLamportsBalance.sub(balanceLamports)
  while (remainingLamportsToAirdrop.gtn(0)) {
    const airdropLamports = BN.min(LAMPORTS_AIRDROP_CAP, remainingLamportsToAirdrop)
    await airdrop(account, airdropLamports.toNumber())
    remainingLamportsToAirdrop = remainingLamportsToAirdrop.sub(airdropLamports)
  }
}
