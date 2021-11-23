import { web3, BN } from '@project-serum/anchor'

export const enum ProgramDerivedAddressSeed {
  LIQ_POOL_MINT_AUTHORITY = 'liq_mint',
  LIQ_POOL_MSOL_ACCOUNT = 'liq_st_sol',
  LIQ_POOL_MSOL_AUTHORITY = 'liq_st_sol_authority',
  LIQ_POOL_MSOL_MINT_AUTHORITY = 'st_mint',
  LIQ_POOL_SOL_ACCOUNT = 'liq_sol',
  RESERVE_ACCOUNT = 'reserve',
  UNIQUE_VALIDATOR = 'unique_validator',
}

export namespace MarinadeStateResponse {
  export interface Fee {
    basisPoints: number
  }

  export interface AccountList {
    account: web3.PublicKey
    itemSize: number
    count: number
    newAccount: web3.PublicKey
    copiedCount: number
  }

  export interface StakeSystem {
    stakeList: AccountList
    delayedUnstakeCoolingDown: BN
    stakeDepositBumpSeed: number
    stakeWithdrawBumpSeed: number
    slotsForStakeDelta: BN
    lastStakeDeltaEpoch: BN
    minStake: BN
    extraStakeDeltaRuns: number
  }

  export interface ValidatorSystem {
    validatorList: AccountList
    managerAuthority: web3.PublicKey
    totalValidatorScore: number
    totalActiveBalance: BN
    autoAddValidatorEnabled: number
  }

  export interface LiqPool {
    lpMint: web3.PublicKey
    lpMintAuthorityBumpSeed: number
    solLegBumpSeed: number
    msolLegAuthorityBumpSeed: number
    msolLeg: web3.PublicKey
    lpLiquidityTarget: BN
    lpMaxFee: Fee
    lpMinFee: Fee
    treasuryCut: Fee
    lpSupply: BN
    lentFromSolLeg: BN
    liquiditySolCap: BN
  }
}

export interface MarinadeStateResponse {
  msolMint: web3.PublicKey
  adminAuthority: web3.PublicKey
  operationalSolAccount: web3.PublicKey
  treasuryMsolAccount: web3.PublicKey
  reserveBumpSeed: number
  msolMintAuthorityBumpSeed: number
  rentExemptForTokenAcc: BN
  rewardFee: MarinadeStateResponse.Fee
  stakeSystem: MarinadeStateResponse.StakeSystem
  validatorSystem: MarinadeStateResponse.ValidatorSystem
  liqPool: MarinadeStateResponse.LiqPool
  availableReserveBalance: BN
  msolSupply: BN
  msolPrice: BN
  circulatingTicketCount: BN
  circulatingTicketBalance: BN
  lentFromReserve: BN
  minDeposit: BN
  minWithdraw: BN
  stakingSolCap: BN
  emergencyCoolingDown: BN
}
