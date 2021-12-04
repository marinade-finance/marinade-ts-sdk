import { Idl, Program, Provider, Wallet } from '@project-serum/anchor'
import { BN, Marinade, MarinadeConfig, web3, MarinadeUtils } from '../src'
import { ProgramDerivedAddressSeed } from '../src/marinade-state/marinade-state.types'
import * as marinadeReferralIdlSchema from '../src/programs/idl/marinade-referral-idl.json'

describe('Referral', () => {
  // const PROVIDER_URL = 'http://localhost:8899'
  const PROVIDER_URL = 'https://api.devnet.solana.com'

  const MARINADE_REFERRAL_PROGRAM_ID = new web3.PublicKey('FqYPYHc3man91xYDCugbGuDdWgkNLp5TvbXPascHW6MR')

  const SOL_AIRDROP_CAP = 5
  const LAMPORTS_AMOUNT_AIRDROP = MarinadeUtils.solToLamports(SOL_AIRDROP_CAP).toNumber()

  const USER_KEYPAIR = web3.Keypair.fromSecretKey(new Uint8Array([
    120, 45, 242, 38, 63, 135, 84, 226, 66, 56, 76,
    216, 125, 144, 38, 182, 53, 47, 169, 251, 128, 65,
    185, 237, 41, 47, 64, 53, 158, 124, 64, 2, 132,
    229, 176, 107, 25, 190, 28, 223, 58, 136, 95, 237,
    236, 176, 26, 160, 11, 12, 131, 129, 21, 8, 221,
    100, 249, 221, 177, 114, 143, 231, 102, 250,
  ]))
  // const USER = Wallet.local().payer
  // const PARTNER = web3.Keypair.generate()

  const provider = new Provider(
    new web3.Connection(PROVIDER_URL),
    new Wallet(USER_KEYPAIR),
    { commitment: 'confirmed' },
  )
  // const marinadeReferralProgram = new Program(marinadeReferralIdlSchema as Idl, MARINADE_REFERRAL_PROGRAM_ID, provider)
  // const findReferralCode = async () => {
  //   const [address] = await web3.PublicKey.findProgramAddress(
  //     [
  //       PARTNER.publicKey.toBuffer(),
  //       Buffer.from(ProgramDerivedAddressSeed.REFERRAL_STATE),
  //     ],
  //     MARINADE_REFERRAL_PROGRAM_ID,
  //   )
  //   return address
  // }

  console.log('User', USER_KEYPAIR.publicKey.toBase58(), USER_KEYPAIR.secretKey)

  beforeAll(async() => {
    const signature = await provider.connection.requestAirdrop(USER_KEYPAIR.publicKey, LAMPORTS_AMOUNT_AIRDROP)
    await provider.connection.confirmTransaction(signature)
    console.log('Airdrop:', signature)
  })

  // LJ: if we work with a keypair (meaning we have the priv key) that will be incompatible if we try to use this lib
  // from a FE project that connects with wallets.
  //
  // Can you please analyze if we can send a `@project-serum/anchor::Provider` object to `new MarinadeConfig`
  // instead of sending `anchorProviderUrl` and `USER_KEYPAIR` ?


  describe('deposit', () => {
    it('deposits SOL', async() => {
      const referralCode = new web3.PublicKey('5H2yKwFRmB1o3syXfXM72mR3iSyop47D1RxF1RcZ8ky5')
      console.log('ReferralCode:', referralCode.toBase58())

      const config = new MarinadeConfig({
        anchorProviderUrl: PROVIDER_URL,
        referralCode,
        wallet: USER_KEYPAIR,
      })
      const marinade = new Marinade(config)

      const result = await marinade.liquidUnstake(new BN(4e8))
      // const result = await marinade.depositStakeAccount(new web3.PublicKey('FYPHkZ3SVZscHpzaYhLHWKzfe9LcGc5WKbUdb2gTuUrV'))
      console.log('Deposit result:', result)
    })
  })
})
