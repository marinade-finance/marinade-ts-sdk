import { deserializeUnchecked } from 'borsh'
import { MarinadeMint } from '../marinade-mint/marinade-mint'
import { bounds } from '../util'
import * as StateHelper from '../util/state-helpers'
import { StakeRecord } from './borsh/stake-record'
import { STAKE_STATE_BORSH_SCHEMA, StakeState } from './borsh/stake-state'
import { ValidatorRecord } from './borsh/validator-record'
import {
  ProgramDerivedAddressSeed,
  MarinadeStateResponse,
  MarinadeState,
} from './marinade-state.types'
import { StakeInfo } from './borsh/stake-info'
import {
  ValidatorRecordAnchorType,
  StateRecordAnchorType,
  MarinadeFinanceProgram,
} from '../programs/marinade-finance-program'
import { DEFAULT_MARINADE_STATE_ADDRESS } from '../config/marinade-config'
import {
  AccountInfo,
  Connection,
  PublicKey,
  StakeProgram,
} from '@solana/web3.js'
import BN from 'bn.js'

export async function fetchMarinadeState(
  program: MarinadeFinanceProgram,
  marinadeStateAddress: PublicKey = DEFAULT_MARINADE_STATE_ADDRESS
): Promise<Readonly<MarinadeState>> {
  const stateResponse = (await program.account.state.fetch(
    marinadeStateAddress
  )) as unknown as MarinadeStateResponse
  return {
    programId: program.programId,
    address: marinadeStateAddress,
    ...stateResponse,
  }
}

/**
 * Configuration parameters for getting program derived addresses
 * for Marinade program.
 *
 * @param programId The Marinade program ID.
 * @param address The Marinade state account address.
 */
export type ProgramDerivedAddressConfig = {
  programId: PublicKey
  address: PublicKey
}

export function reserveAddress(config: ProgramDerivedAddressConfig): PublicKey {
  return findProgramDerivedAddress({
    config,
    seed: ProgramDerivedAddressSeed.RESERVE_ACCOUNT,
  })
}

export function mSolMintAuthority(
  config: ProgramDerivedAddressConfig
): PublicKey {
  return findProgramDerivedAddress({
    config,
    seed: ProgramDerivedAddressSeed.LIQ_POOL_MSOL_MINT_AUTHORITY,
  })
}

export function mSolLegAuthority(
  config: ProgramDerivedAddressConfig
): PublicKey {
  return findProgramDerivedAddress({
    config,
    seed: ProgramDerivedAddressSeed.LIQ_POOL_MSOL_AUTHORITY,
  })
}

export function lpMintAuthority(
  config: ProgramDerivedAddressConfig
): PublicKey {
  return findProgramDerivedAddress({
    config,
    seed: ProgramDerivedAddressSeed.LIQ_POOL_MINT_AUTHORITY,
  })
}

export function solLeg(config: ProgramDerivedAddressConfig): PublicKey {
  return findProgramDerivedAddress({
    config,
    seed: ProgramDerivedAddressSeed.LIQ_POOL_SOL_ACCOUNT,
  })
}

export function validatorDuplicationFlag(
  config: ProgramDerivedAddressConfig,
  validatorAddress: PublicKey
): PublicKey {
  return findProgramDerivedAddress({
    config,
    seed: ProgramDerivedAddressSeed.UNIQUE_VALIDATOR,
    extraSeeds: [validatorAddress.toBuffer()],
  })
}

export function stakeWithdrawAuthority(
  config: ProgramDerivedAddressConfig,
  nonce: number
): PublicKey {
  return findProgramDerivedAddressWithNonce({
    config,
    seed: ProgramDerivedAddressSeed.STAKE_WITHDRAW_SEED,
    nonce,
  })
}

export function findProgramDerivedAddress({
  config,
  seed,
  extraSeeds = [],
}: {
  config: ProgramDerivedAddressConfig
  seed: ProgramDerivedAddressSeed
  extraSeeds?: Buffer[]
}): PublicKey {
  const seeds = [config.address.toBuffer(), Buffer.from(seed), ...extraSeeds]
  const [programAddress] = PublicKey.findProgramAddressSync(
    seeds,
    config.programId
  )
  return programAddress
}

export function findProgramDerivedAddressWithNonce({
  config,
  seed,
  nonce,
  extraSeeds = [],
}: {
  config: ProgramDerivedAddressConfig
  seed: ProgramDerivedAddressSeed
  nonce: number
  extraSeeds?: Buffer[]
}): PublicKey {
  if (nonce > 255 || nonce < 0) {
    throw new Error(
      `Invalid nonce ${nonce}, must be a number between 0 and 255`
    )
  }
  const seeds = [config.address.toBuffer(), Buffer.from(seed), ...extraSeeds]
  const seedsWithNonce = seeds.concat(Buffer.from([nonce]))
  return PublicKey.createProgramAddressSync(seedsWithNonce, config.programId)
}

export function mSolPrice(state: MarinadeState): number {
  return state.msolPrice.toNumber() / 0x1_0000_0000
}

export function mSolMint(connection: Connection, state: MarinadeState) {
  return MarinadeMint.build(connection, state.msolMint)
}

export function lpMint(connection: Connection, state: MarinadeState) {
  return MarinadeMint.build(connection, state.liqPool.lpMint)
}

export async function unstakeNowFeeBp(
  connection: Connection,
  config: ProgramDerivedAddressConfig,
  state: MarinadeState,
  lamportsToObtain: BN
): Promise<number> {
  const solLegAddress = solLeg(config)
  const solLegBalance = await connection.getBalance(solLegAddress)
  const maxLamports = new BN(solLegBalance).sub(state.rentExemptForTokenAcc)
  return StateHelper.unstakeNowFeeBp(
    state.liqPool.lpMinFee.basisPoints,
    state.liqPool.lpMaxFee.basisPoints,
    state.liqPool.lpLiquidityTarget,
    maxLamports,
    lamportsToObtain
  )
}

/**
 * stakeDelta is roughly: stake-orders (deposits) minus unstake-orders during the epoch.
 * before the end of the epoch, the bot will perform staking, if stakeDelta is positive,
 * or unstaking, if stakeDelta is negative.
 */
export function stakeDelta(state: MarinadeState): BN {
  // Source: Rust main code: pub fn stake_delta(&self, reserve_balance: u64) -> i128
  // Never try to stake lamports from emergency_cooling_down
  // (we must wait for update-deactivated first to keep SOLs for claiming on reserve)
  // But if we need to unstake without counting emergency_cooling_down and we have emergency cooling down
  // then we can count part of emergency stakes as starting to cooling down delayed unstakes
  // preventing unstake duplication by recalculating stake-delta for negative values

  // OK. Lets get stake_delta without emergency first
  const raw = state.availableReserveBalance
    .sub(state.rentExemptForTokenAcc)
    .add(state.stakeSystem.delayedUnstakeCoolingDown)
    .sub(state.circulatingTicketBalance)
  if (!raw.isNeg() || raw.isZero()) {
    // When it >= 0 it is right value to use
    return raw
  } else {
    // Otherwise try to recalculate it with emergency
    const withEmergency = raw.add(state.emergencyCoolingDown)
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
export async function getValidatorRecords(
  program: MarinadeFinanceProgram,
  state: MarinadeState
): Promise<{
  validatorRecords: ValidatorRecord[]
  capacity: number
}> {
  const { validatorList } = state.validatorSystem
  const recordBounds = (index: number) =>
    bounds(index, validatorList.itemSize, 8)

  const validators = await program.provider.connection.getAccountInfo(
    validatorList.account
  )

  if (!validators) {
    throw new Error("Failed to fetch validators' details!")
  }

  return {
    validatorRecords: Array.from(
      { length: validatorList.count },
      (_, index) => {
        return program.coder.types.decode<ValidatorRecordAnchorType>(
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
export async function getStakeRecords(
  program: MarinadeFinanceProgram,
  state: MarinadeState
): Promise<{
  stakeRecords: StakeRecord[]
  capacity: number
}> {
  const { stakeList } = state.stakeSystem
  const recordBounds = (index: number) => bounds(index, stakeList.itemSize, 8)

  const stakes = await program.provider.connection.getAccountInfo(
    stakeList.account
  )

  if (!stakes) {
    throw new Error("Failed to fetch stakes' details!")
  }

  return {
    stakeRecords: Array.from({ length: stakeList.count }, (_, index) => {
      return program.coder.types.decode<StateRecordAnchorType>(
        'StakeRecord',
        stakes.data.subarray(...recordBounds(index))
      )
    }),
    capacity: (stakes.data.length - 8) / stakeList.itemSize,
  }
}

export async function getStakeStates(
  connection: Connection,
  state: MarinadeState
): Promise<StakeState[]> {
  const stakeWithdrawAuthPDA = stakeWithdrawAuthority(
    state,
    state.stakeSystem.stakeWithdrawBumpSeed
  )
  const stakeAccountInfos = await connection.getProgramAccounts(
    StakeProgram.programId,
    {
      filters: [
        { dataSize: 200 },
        {
          memcmp: {
            offset: 44,
            bytes: stakeWithdrawAuthPDA.toBase58(),
          },
        },
      ],
    }
  )

  return stakeAccountInfos.map(stakeAccountInfo => {
    const { data } = stakeAccountInfo.account
    return deserializeStakeState(data)
  })
}

function deserializeStakeState(data: Buffer): StakeState {
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
export async function getStakeInfos(
  program: MarinadeFinanceProgram,
  state: MarinadeState
): Promise<{
  stakeInfos: StakeInfo[]
  capacity: number
}> {
  const { stakeRecords, capacity } = await getStakeRecords(program, state)
  const stakeInfos = new Array<StakeInfo>()

  const toProcess = stakeRecords.length
  let processed = 0
  // rpc.get_multiple_accounts() has a max of 100 accounts
  const BATCH_SIZE = 100
  while (processed < toProcess) {
    const accountInfos: AccountInfo<Buffer>[] =
      (await program.provider.connection.getMultipleAccountsInfo(
        stakeRecords
          .slice(processed, processed + BATCH_SIZE)
          .map(stakeRecord => stakeRecord.stakeAccount)
      )) as AccountInfo<Buffer>[]

    stakeInfos.push(
      ...accountInfos.map((accountInfo, index) => {
        return new StakeInfo({
          index: processed + index,
          record: stakeRecords[processed + index],
          stake: deserializeStakeState(accountInfo?.data),
          balance: new BN(accountInfo.lamports),
        })
      })
    )
    processed += BATCH_SIZE
  }
  return { stakeInfos: stakeInfos, capacity: capacity }
}

/**
 * Commission in %
 */
export function rewardsCommissionPercent(state: MarinadeState): number {
  return state.rewardFee.basisPoints / 100
}
