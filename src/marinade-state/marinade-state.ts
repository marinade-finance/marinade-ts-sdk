import { BN, Provider, web3 } from '@coral-xyz/anchor'
import { deserializeUnchecked } from 'borsh'
import { Marinade } from '../marinade'
import { MarinadeMint } from '../marinade-mint/marinade-mint'
import { bounds, STAKE_PROGRAM_ID } from '../util'
import * as StateHelper from '../util/state-helpers'
import { StakeRecord } from './borsh/stake-record'
import { STAKE_STATE_BORSH_SCHEMA, StakeState } from './borsh/stake-state'
import { ValidatorRecord } from './borsh/validator-record'
import {
  ProgramDerivedAddressSeed,
  MarinadeStateResponse,
} from './marinade-state.types'
import { StakeInfo } from './borsh/stake-info'
import {
  ValidatorRecordAnchorType,
  StateRecordAnchorType,
} from '../programs/marinade-finance-program'

export class MarinadeState {
  // @todo rework args
  private constructor(
    private readonly marinade: Marinade,
    private readonly anchorProvider: Provider,
    public readonly state: MarinadeStateResponse,
    public readonly marinadeStateAddress: web3.PublicKey,
    public readonly marinadeFinanceProgramId: web3.PublicKey
  ) {}

  static async fetch(marinade: Marinade) {
    // @todo rework args
    const { marinadeFinanceProgram, config } = marinade
    const state = (await marinadeFinanceProgram.program.account.state.fetch(
      config.marinadeStateAddress
    )) as unknown as MarinadeStateResponse
    return new MarinadeState(
      marinade,
      marinade.provider,
      state,
      config.marinadeStateAddress,
      config.marinadeFinanceProgramId
    )
  }

  reserveAddress = async () =>
    this.findProgramDerivedAddress(ProgramDerivedAddressSeed.RESERVE_ACCOUNT)

  mSolPrice: number = this.state.msolPrice.toNumber() / 0x1_0000_0000

  mSolMintAddress: web3.PublicKey = this.state.msolMint
  mSolMint = MarinadeMint.build(this.anchorProvider, this.mSolMintAddress)
  mSolMintAuthority = async () =>
    this.findProgramDerivedAddress(
      ProgramDerivedAddressSeed.LIQ_POOL_MSOL_MINT_AUTHORITY
    )
  mSolLegAuthority = async () =>
    this.findProgramDerivedAddress(
      ProgramDerivedAddressSeed.LIQ_POOL_MSOL_AUTHORITY
    )
  mSolLeg = this.state.liqPool.msolLeg

  lpMintAddress: web3.PublicKey = this.state.liqPool.lpMint
  lpMint = MarinadeMint.build(this.anchorProvider, this.lpMintAddress)
  lpMintAuthority = async () =>
    this.findProgramDerivedAddress(
      ProgramDerivedAddressSeed.LIQ_POOL_MINT_AUTHORITY
    )

  solLeg = async () =>
    this.findProgramDerivedAddress(
      ProgramDerivedAddressSeed.LIQ_POOL_SOL_ACCOUNT
    )

  stakeDepositAuthority = async () =>
    this.findProgramDerivedAddress(ProgramDerivedAddressSeed.STAKE_DEPOSIT)
  stakeWithdrawAuthority = async () =>
    this.findProgramDerivedAddress(ProgramDerivedAddressSeed.STAKE_WITHDRAW)

  private async findProgramDerivedAddress(
    seed: ProgramDerivedAddressSeed,
    extraSeeds: Buffer[] = []
  ): Promise<web3.PublicKey> {
    const seeds = [
      this.marinade.config.marinadeStateAddress.toBuffer(),
      Buffer.from(seed),
      ...extraSeeds,
    ]
    const [result] = await web3.PublicKey.findProgramAddress(
      seeds,
      this.marinade.config.marinadeFinanceProgramId
    )
    return result
  }

  validatorDuplicationFlag = async (validatorAddress: web3.PublicKey) =>
    this.findProgramDerivedAddress(ProgramDerivedAddressSeed.UNIQUE_VALIDATOR, [
      validatorAddress.toBuffer(),
    ])
  epochInfo = async () => this.anchorProvider.connection.getEpochInfo()

  async unstakeNowFeeBp(lamportsToObtain: BN): Promise<number> {
    const solLeg = await this.solLeg()
    const solLegBalance = await this.anchorProvider.connection.getBalance(
      solLeg
    )
    const maxLamports = new BN(solLegBalance).sub(
      this.state.rentExemptForTokenAcc
    )

    return StateHelper.unstakeNowFeeBp(
      this.state.liqPool.lpMinFee.basisPoints,
      this.state.liqPool.lpMaxFee.basisPoints,
      this.state.liqPool.lpLiquidityTarget,
      maxLamports,
      lamportsToObtain
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
    const raw = this.state.availableReserveBalance
      .sub(this.state.rentExemptForTokenAcc)
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

  /**
   * return validatorRecords with capacity
   */
  async getValidatorRecords(): Promise<{
    validatorRecords: ValidatorRecord[]
    capacity: number
  }> {
    const { validatorList } = this.state.validatorSystem
    const recordBounds = (index: number) =>
      bounds(index, validatorList.itemSize, 8)

    const validators = await this.anchorProvider.connection.getAccountInfo(
      validatorList.account
    )

    if (!validators) {
      throw new Error("Failed to fetch validators' details!")
    }

    return {
      validatorRecords: Array.from(
        { length: validatorList.count },
        (_, index) => {
          return this.marinade.marinadeFinanceProgram.program.coder.types.decode<ValidatorRecordAnchorType>(
            'ValidatorRecord',
            validators.data.subarray(...recordBounds(index))
          )
        }
      ),
      capacity: (validators.data.length - 8) / validatorList.itemSize,
    }
  }

  /**
   * return stakeRecords with capacity
   */
  async getStakeRecords(): Promise<{
    stakeRecords: StakeRecord[]
    capacity: number
  }> {
    const { stakeList } = this.state.stakeSystem
    const recordBounds = (index: number) => bounds(index, stakeList.itemSize, 8)

    const stakes = await this.anchorProvider.connection.getAccountInfo(
      stakeList.account
    )

    if (!stakes) {
      throw new Error("Failed to fetch stakes' details!")
    }

    return {
      stakeRecords: Array.from({ length: stakeList.count }, (_, index) => {
        return this.marinade.marinadeFinanceProgram.program.coder.types.decode<StateRecordAnchorType>(
          'StakeRecord',
          stakes.data.subarray(...recordBounds(index))
        )
      }),
      capacity: (stakes.data.length - 8) / stakeList.itemSize,
    }
  }

  async getStakeStates(): Promise<StakeState[]> {
    const stakeAccountInfos =
      await this.anchorProvider.connection.getProgramAccounts(
        STAKE_PROGRAM_ID,
        {
          filters: [
            { dataSize: 200 },
            {
              memcmp: {
                offset: 44,
                bytes: this.marinade.config.stakeWithdrawAuthPDA.toString(),
              },
            },
          ],
        }
      )

    return stakeAccountInfos.map(stakeAccountInfo => {
      const { data } = stakeAccountInfo.account
      return this.deserializeStakeState(data)
    })
  }

  private deserializeStakeState(data: Buffer): StakeState {
    // The data's first 4 bytes are: u8 0x0 0x0 0x0 but borsh uses only the first byte to find the enum's value index.
    // The next 3 bytes are unused and we need to get rid of them (or somehow fix the BORSH schema?)
    const adjustedData = Buffer.concat([
      data.subarray(0, 1), // the first byte indexing the enum
      data.subarray(4, data.length), // the first byte indexing the enum
    ])
    return deserializeUnchecked(
      STAKE_STATE_BORSH_SCHEMA,
      StakeState,
      adjustedData
    )
  }

  /**
   * return listStakeInfos with capacity
   */
  async getStakeInfos(): Promise<{
    stakeInfos: StakeInfo[]
    capacity: number
  }> {
    const { stakeRecords, capacity } = await this.getStakeRecords()
    const stakeInfos = new Array<StakeInfo>()

    const toProcess = stakeRecords.length
    let processed = 0
    // rpc.get_multiple_accounts() has a max of 100 accounts
    const BATCH_SIZE = 100
    while (processed < toProcess) {
      const accountInfos: web3.AccountInfo<Buffer>[] =
        (await this.anchorProvider.connection.getMultipleAccountsInfo(
          stakeRecords
            .slice(processed, processed + BATCH_SIZE)
            .map(stakeRecord => stakeRecord.stakeAccount)
        )) as web3.AccountInfo<Buffer>[]

      stakeInfos.push(
        ...accountInfos.map((accountInfo, index) => {
          return new StakeInfo({
            index: processed + index,
            record: stakeRecords[processed + index],
            stake: this.deserializeStakeState(accountInfo?.data),
            balance: new BN(accountInfo.lamports),
          })
        })
      )
      processed += BATCH_SIZE
    }
    return { stakeInfos: stakeInfos, capacity: capacity }
  }

  treasuryMsolAccount: web3.PublicKey = this.state.treasuryMsolAccount

  /**
   * Commission in %
   */
  rewardsCommissionPercent: number = this.state.rewardFee.basisPoints / 100

  /**
   * Max Stake moved per epoch in %
   */
  maxStakeMovedPerEpoch: number =
    this.state.maxStakeMovedPerEpoch.basisPoints / 100
}
