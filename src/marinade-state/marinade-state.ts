import { BN, Provider, web3 } from '@project-serum/anchor'
import { deserializeUnchecked } from 'borsh'
import { Marinade } from '../marinade'
import { MarinadeMint } from '../marinade-mint/marinade-mint'
import { bounds } from '../util'
import * as StateHelper from '../util/state-helpers'
import { MARINADE_BORSH_SCHEMA, StakeRecord, ValidatorRecord } from './marinade-borsch'
import { ProgramDerivedAddressSeed, MarinadeStateResponse } from './marinade-state.types'

export class MarinadeState {
  // @todo rework args
  private constructor(
    private readonly marinade: Marinade,
    private readonly anchorProvider: Provider,
    public readonly state: MarinadeStateResponse,
  ) { }

  static async fetch(marinade: Marinade) { // @todo rework args
    const { marinadeProgram, config } = marinade
    const state = await marinadeProgram.account.state.fetch(config.marinadeStateAddress) as MarinadeStateResponse
    return new MarinadeState(marinade, marinade.anchorProvider, state)
  }

  reserveAddress = async() => this.findProgramDerivedAddress(ProgramDerivedAddressSeed.RESERVE_ACCOUNT)

  mSolPrice: number = this.state.msolPrice.toNumber() / 0x1_0000_0000

  mSolMintAddress: web3.PublicKey = this.state.msolMint
  mSolMint = MarinadeMint.build(this.anchorProvider, this.mSolMintAddress)
  mSolMintAuthority = async() => this.findProgramDerivedAddress(ProgramDerivedAddressSeed.LIQ_POOL_MSOL_MINT_AUTHORITY)
  mSolLegAuthority = async() => this.findProgramDerivedAddress(ProgramDerivedAddressSeed.LIQ_POOL_MSOL_AUTHORITY)
  mSolLeg = this.state.liqPool.msolLeg

  lpMintAddress: web3.PublicKey = this.state.liqPool.lpMint
  lpMint = MarinadeMint.build(this.anchorProvider, this.lpMintAddress)
  lpMintAuthority = async() => this.findProgramDerivedAddress(ProgramDerivedAddressSeed.LIQ_POOL_MINT_AUTHORITY)

  solLeg = async() => this.findProgramDerivedAddress(ProgramDerivedAddressSeed.LIQ_POOL_SOL_ACCOUNT)

  private async findProgramDerivedAddress(seed: ProgramDerivedAddressSeed, extraSeeds: Buffer[] = []): Promise<web3.PublicKey> {
    const seeds = [this.marinade.config.marinadeStateAddress.toBuffer(), Buffer.from(seed), ...extraSeeds]
    const [result] = await web3.PublicKey.findProgramAddress(seeds, this.marinade.config.marinadeProgramId)
    return result
  }

  validatorDuplicationFlag = async(validatorAddress: web3.PublicKey) => this.findProgramDerivedAddress(ProgramDerivedAddressSeed.UNIQUE_VALIDATOR, [validatorAddress.toBuffer()])

  async unstakeNowFeeBp(lamportsToObtain: BN): Promise<number> {
    const mSolMintClient = this.mSolMint.mintClient()
    const mSolLegInfo = await mSolMintClient.getAccountInfo(this.mSolLeg)
    const lamportsAvailable = mSolLegInfo.amount

    return StateHelper.unstakeNowFeeBp(
      this.state.liqPool.lpMinFee.basisPoints,
      this.state.liqPool.lpMaxFee.basisPoints,
      this.state.liqPool.lpLiquidityTarget,
      lamportsAvailable,
      lamportsToObtain,
    )
  }

  // stakeDelta is roughly: stake-orders (deposits) minus unstake-orders during the epoch.
  // before the end of the epoch, the bot will perform staking, if stakeDelta is positive,
  // or unstaking, if stakeDelta is negative.
  stakeDelta(): BN {
    // Source: Rust main code: pub fn stake_delta(&self, reserve_balance: u64) -> i128 
    // Never try to stake lamports from emergency_cooling_down
    // (we must wait for update-deactivated first to keep SOLs for claiming on reserve)
    // But if we need to unstake without counting emergency_cooling_down and we have emergency cooling down
    // then we can count part of emergency stakes as starting to cooling down delayed unstakes
    // preventing unstake duplication by recalculating stake-delta for negative values

    // OK. Lets get stake_delta without emergency first
    const raw = this.state.availableReserveBalance.sub(this.state.rentExemptForTokenAcc)
      .add(this.state.stakeSystem.delayedUnstakeCoolingDown)
      .sub(this.state.circulatingTicketBalance)
    if (!raw.isNeg() || raw.isZero()) {
      // When it >= 0 it is right value to use
      return raw
    } else {
      // Otherwise try to recalculate it with emergency
      const withEmergency = raw.add(this.state.emergencyCoolingDown)
      // And make sure it will not become positive
      if (withEmergency.isNeg()) {
        return withEmergency
      }
      return new BN(0)
    }
  }


  async getValidatorRecords(): Promise<ValidatorRecord[]> {
    const { validatorList } = this.state.validatorSystem
    const recordBounds = (index: number) => bounds(index, validatorList.itemSize, 8)

    const validators = await this.anchorProvider.connection.getAccountInfo(validatorList.account)

    if (!validators) {
      throw new Error(`Failed to fetch validators' details!`)
    }

    return Array.from(
      { length: validatorList.count },
      (_, index) => {
        return deserializeUnchecked(
          MARINADE_BORSH_SCHEMA,
          ValidatorRecord,
          validators.data.slice(...recordBounds(index))
        )
      }
    )
  }

  async getStakeRecords(): Promise<StakeRecord[]> {
    const { stakeList } = this.state.stakeSystem
    const recordBounds = (index: number) => bounds(index, stakeList.itemSize, 8)

    const stakes = await this.anchorProvider.connection.getAccountInfo(stakeList.account)

    if (!stakes) {
      throw new Error(`Failed to fetch stakes' details!`)
    }

    return Array.from(
      { length: stakeList.count },
      (_, index) => {
        return deserializeUnchecked(
          MARINADE_BORSH_SCHEMA,
          StakeRecord,
          stakes.data.slice(...recordBounds(index))
        )
      }
    )
  }

  treasuryMsolAccount: web3.PublicKey = this.state.treasuryMsolAccount

  /**
   * Commission in %
   */
  rewardsCommissionPercent: number = this.state.rewardFee.basisPoints / 100
}
