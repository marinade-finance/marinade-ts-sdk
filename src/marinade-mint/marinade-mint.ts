import { BN, Provider, web3 } from '@project-serum/anchor'
import { getMint, Mint } from '@solana/spl-token'
import { tokenBalanceToNumber } from '../util/conversion'

export class MarinadeMint {
  private constructor(
    private readonly anchorProvider: Provider,
    public readonly address: web3.PublicKey
  ) { }

  static build(anchorProvider: Provider, mintAddress: web3.PublicKey): MarinadeMint {
    return new MarinadeMint(anchorProvider, mintAddress)
  }

  /**
   * Returns Total supply as a number with decimals
   * @param mintInfoCached optional
   * @returns 
   */
  async totalSupply(mintInfoCached?: Mint): Promise<number> {
    const mintInfo = mintInfoCached ?? await getMint(this.anchorProvider.connection, this.address)
    return tokenBalanceToNumber(new BN(mintInfo.supply.toString()), mintInfo.decimals)
  }

  /**
   * @deprecated use totalSupply() instead
   */
  async tokenBalance(mintInfoCached?: Mint): Promise<number> {
    return this.totalSupply(mintInfoCached)
  }

}
