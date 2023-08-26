import { web3, BN } from '@coral-xyz/anchor'
import { getMint, Mint } from '@solana/spl-token-3.x'
import { tokenBalanceToNumber } from '../util/conversion'

export class MarinadeMint {
  private constructor(
    private readonly connection: web3.Connection,
    public readonly address: web3.PublicKey
  ) {}

  static build(
    connection: web3.Connection,
    mintAddress: web3.PublicKey
  ): MarinadeMint {
    return new MarinadeMint(connection, mintAddress)
  }

  mintInfo = (): Promise<Mint> => getMint(this.connection, this.address)

  /**
   * Returns Total supply as a number with decimals
   * @param mintInfoCached optional
   * @returns
   */
  async totalSupply(mintInfoCached?: Mint): Promise<number> {
    const mintInfo = mintInfoCached ?? (await this.mintInfo())
    return tokenBalanceToNumber(
      new BN(mintInfo.supply.toString()),
      mintInfo.decimals
    )
  }

  /**
   * @deprecated use totalSupply() instead
   */
  async tokenBalance(mintInfoCached?: Mint): Promise<number> {
    return this.totalSupply(mintInfoCached)
  }
}
