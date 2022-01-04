import { Marinade, MarinadeConfig, MarinadeUtils, Wallet, web3 } from '../src'
import * as TestWorld from './test-world'

const MINIMUM_LAMPORTS_BEFORE_TEST = MarinadeUtils.solToLamports(2.5)

describe('Marinade Finance', () => {
  beforeAll(async() => {
    await TestWorld.provideMinimumLamportsBalance(TestWorld.SDK_USER.publicKey, MINIMUM_LAMPORTS_BEFORE_TEST)
  })

  describe('deposit', () => {
    it('deposits SOL', async() => {
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
        publicKey: TestWorld.SDK_USER.publicKey,
        referralCode: TestWorld.REFERRAL_CODE,
      })
      const marinade = new Marinade(config)

      const { transaction } = await marinade.deposit(MarinadeUtils.solToLamports(1))
      const transactionSignature = await TestWorld.PROVIDER.send(transaction)
      console.log('Deposit tx:', transactionSignature)
    })

    it('deposits SOL and get mSOL to another account', async() => {
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
        publicKey: TestWorld.SDK_USER.publicKey,
        referralCode: TestWorld.REFERRAL_CODE,
      })
      const marinade = new Marinade(config)

      const anotherAccount = web3.Keypair.generate()
      const { transaction } = await marinade.deposit(MarinadeUtils.solToLamports(1), { mintToOwnerAddress: anotherAccount.publicKey })
      const transactionSignature = await TestWorld.PROVIDER.send(transaction)
      console.log('Deposit tx:', transactionSignature)
    })
  })

  describe('liquidUnstake', () => {
    it('unstakes SOL', async() => {
      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
        publicKey: TestWorld.SDK_USER.publicKey,
        referralCode: TestWorld.REFERRAL_CODE,
      })
      const marinade = new Marinade(config)

      const { transaction } = await marinade.liquidUnstake(MarinadeUtils.solToLamports(0.8))
      const transactionSignature = await TestWorld.PROVIDER.send(transaction)
      console.log('Liquid unstake tx:', transactionSignature)
    })
  })

  describe.skip('depositStakeAccount', () => {
    it('deposits stake account', async() => {
      console.log('ReferralCode:', TestWorld.REFERRAL_CODE.toBase58())

      const config = new MarinadeConfig({
        connection: TestWorld.CONNECTION,
        publicKey: Wallet.local().payer.publicKey,
        referralCode: TestWorld.REFERRAL_CODE,
      })
      const marinade = new Marinade(config)

      const { transaction } = await marinade.depositStakeAccount(new web3.PublicKey('2hpYdXDUxWwZFSx6RQVuPHSHuVVZU2Bsz4VLiLvvoG2h'))
      const transactionSignature = await TestWorld.PROVIDER.send(transaction)
      console.log('Deposit stake account tx:', transactionSignature)
    })
  })
})
