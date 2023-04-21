import { BN, web3 } from '@coral-xyz/anchor'
import { deserializeF64, deserializePublicKey } from './common'

export class StakeState {
  Uninitialized?: StakeState.UninitializedState
  Initialized?: StakeState.InitializedState
  Stake?: StakeState.StakeState
  RewardsPool?: StakeState.RewardsPoolState

  constructor(args: StakeState) {
    Object.assign(this, args)
  }
}

export namespace StakeState {
  export class UninitializedState {
    constructor(args: UninitializedState) {
      Object.assign(this, args)
    }
  }

  export class InitializedState {
    meta!: Meta

    constructor(args: InitializedState) {
      Object.assign(this, args)
    }
  }

  export class StakeState {
    meta!: Meta
    stake!: Stake

    constructor(args: StakeState) {
      Object.assign(this, args)
    }
  }

  export class RewardsPoolState {
    constructor(args: RewardsPoolState) {
      Object.assign(this, args)
    }
  }
}

export class Meta {
  rentExemptReserve!: BN
  authorized!: Authorized
  lockup!: Lockup

  constructor(args: Meta) {
    Object.assign(this, args)
  }
}

export class Authorized {
  staker!: web3.PublicKey
  withdrawer!: web3.PublicKey

  constructor(args: Authorized) {
    Object.assign(this, args)
  }
}

export class Lockup {
  // UnixTimestamp at which this stake will allow withdrawal, unless the
  //   transaction is signed by the custodian
  unixTimestamp!: BN
  // epoch height at which this stake will allow withdrawal, unless the
  //   transaction is signed by the custodian
  epoch!: BN
  // custodian signature on a transaction exempts the operation from
  //  lockup constraints
  custodian!: web3.PublicKey

  constructor(args: Lockup) {
    Object.assign(this, args)
  }
}

export class Stake {
  delegation!: Delegation
  // credits observed is credits from vote account state when delegated or redeemed
  creditsObserved!: BN

  constructor(args: Stake) {
    Object.assign(this, args)
  }
}

export class Delegation {
  // to whom the stake is delegated
  voterPubkey!: web3.PublicKey
  // activated stake amount, set at delegate() time
  stake!: BN
  // epoch at which this stake was activated, std::Epoch::MAX if is a bootstrap stake
  activationEpoch!: BN
  // epoch the stake was deactivated, std::Epoch::MAX if not deactivated
  deactivationEpoch!: BN
  // how much stake we can activate per-epoch as a fraction of currently effective stake
  warmupCooldownRate!: { value: number }

  constructor(args: Delegation) {
    Object.assign(this, args)
  }
}

export const stakeStateBorshSchema = [
  [
    StakeState.UninitializedState,
    {
      kind: 'struct',
      fields: [],
    },
  ],
  [
    StakeState.InitializedState,
    {
      kind: 'struct',
      fields: [['meta', Meta]],
    },
  ],
  [
    StakeState.StakeState,
    {
      kind: 'struct',
      fields: [
        ['meta', Meta],
        ['stake', Stake],
      ],
    },
  ],
  [
    StakeState.RewardsPoolState,
    {
      kind: 'struct',
      fields: [],
    },
  ],
  [
    Meta,
    {
      kind: 'struct',
      fields: [
        ['rentExemptReserve', 'u64'],
        ['authorized', Authorized],
        ['lockup', Lockup],
      ],
    },
  ],
  [
    Authorized,
    {
      kind: 'struct',
      fields: [
        ['staker', deserializePublicKey],
        ['withdrawer', deserializePublicKey],
      ],
    },
  ],
  [
    Lockup,
    {
      kind: 'struct',
      fields: [
        ['unixTimestamp', 'u64'],
        ['epoch', 'u64'],
        ['custodian', deserializePublicKey],
      ],
    },
  ],
  [
    Stake,
    {
      kind: 'struct',
      fields: [
        ['delegation', Delegation],
        ['creditsObserved', 'u64'],
      ],
    },
  ],
  [
    Delegation,
    {
      kind: 'struct',
      fields: [
        ['voterPubkey', deserializePublicKey],
        ['stake', 'u64'],
        ['activationEpoch', 'u64'],
        ['deactivationEpoch', 'u64'],
        ['warmupCooldownRate', deserializeF64],
      ],
    },
  ],
  [
    StakeState,
    {
      kind: 'enum',
      values: [
        ['Uninitialized', StakeState.UninitializedState],
        ['Initialized', StakeState.InitializedState],
        ['Stake', StakeState.StakeState],
        ['RewardsPool', StakeState.RewardsPoolState],
      ],
    },
  ],
] as const
