export type MarinadeReferral = {
  version: '0.2.0'
  name: 'marinade_referral'
  instructions: [
    {
      name: 'deposit'
      docs: ['deposit SOL']
      accounts: [
        {
          name: 'state'
          isMut: true
          isSigner: false
        },
        {
          name: 'msolMint'
          isMut: true
          isSigner: false
        },
        {
          name: 'liqPoolSolLegPda'
          isMut: true
          isSigner: false
        },
        {
          name: 'liqPoolMsolLeg'
          isMut: true
          isSigner: false
        },
        {
          name: 'liqPoolMsolLegAuthority'
          isMut: false
          isSigner: false
        },
        {
          name: 'reservePda'
          isMut: true
          isSigner: false
        },
        {
          name: 'transferFrom'
          isMut: true
          isSigner: true
        },
        {
          name: 'mintTo'
          isMut: true
          isSigner: false
        },
        {
          name: 'msolMintAuthority'
          isMut: false
          isSigner: false
        },
        {
          name: 'systemProgram'
          isMut: false
          isSigner: false
        },
        {
          name: 'tokenProgram'
          isMut: false
          isSigner: false
        },
        {
          name: 'marinadeFinanceProgram'
          isMut: false
          isSigner: false
        },
        {
          name: 'referralState'
          isMut: true
          isSigner: false
        },
        {
          name: 'msolTokenPartnerAccount'
          isMut: true
          isSigner: false
        }
      ]
      args: [
        {
          name: 'lamports'
          type: 'u64'
        }
      ]
    },
    {
      name: 'depositStakeAccount'
      docs: ['deposit stake account']
      accounts: [
        {
          name: 'state'
          isMut: true
          isSigner: false
        },
        {
          name: 'validatorList'
          isMut: true
          isSigner: false
        },
        {
          name: 'stakeList'
          isMut: true
          isSigner: false
        },
        {
          name: 'stakeAccount'
          isMut: true
          isSigner: false
        },
        {
          name: 'stakeAuthority'
          isMut: false
          isSigner: true
        },
        {
          name: 'duplicationFlag'
          isMut: true
          isSigner: false
        },
        {
          name: 'rentPayer'
          isMut: true
          isSigner: true
        },
        {
          name: 'msolMint'
          isMut: true
          isSigner: false
        },
        {
          name: 'mintTo'
          isMut: true
          isSigner: false
        },
        {
          name: 'msolMintAuthority'
          isMut: false
          isSigner: false
        },
        {
          name: 'clock'
          isMut: false
          isSigner: false
        },
        {
          name: 'rent'
          isMut: false
          isSigner: false
        },
        {
          name: 'systemProgram'
          isMut: false
          isSigner: false
        },
        {
          name: 'tokenProgram'
          isMut: false
          isSigner: false
        },
        {
          name: 'stakeProgram'
          isMut: false
          isSigner: false
        },
        {
          name: 'marinadeFinanceProgram'
          isMut: false
          isSigner: false
        },
        {
          name: 'referralState'
          isMut: true
          isSigner: false
        },
        {
          name: 'msolTokenPartnerAccount'
          isMut: true
          isSigner: false
        }
      ]
      args: [
        {
          name: 'validatorIndex'
          type: 'u32'
        }
      ]
    },
    {
      name: 'liquidUnstake'
      docs: ['liquid-unstake mSOL']
      accounts: [
        {
          name: 'state'
          isMut: true
          isSigner: false
        },
        {
          name: 'msolMint'
          isMut: true
          isSigner: false
        },
        {
          name: 'liqPoolSolLegPda'
          isMut: true
          isSigner: false
        },
        {
          name: 'liqPoolMsolLeg'
          isMut: true
          isSigner: false
        },
        {
          name: 'treasuryMsolAccount'
          isMut: true
          isSigner: false
        },
        {
          name: 'getMsolFrom'
          isMut: true
          isSigner: false
        },
        {
          name: 'getMsolFromAuthority'
          isMut: false
          isSigner: true
        },
        {
          name: 'transferSolTo'
          isMut: true
          isSigner: false
        },
        {
          name: 'systemProgram'
          isMut: false
          isSigner: false
        },
        {
          name: 'tokenProgram'
          isMut: false
          isSigner: false
        },
        {
          name: 'marinadeFinanceProgram'
          isMut: false
          isSigner: false
        },
        {
          name: 'referralState'
          isMut: true
          isSigner: false
        },
        {
          name: 'msolTokenPartnerAccount'
          isMut: true
          isSigner: false
        }
      ]
      args: [
        {
          name: 'msolAmount'
          type: 'u64'
        }
      ]
    },
    {
      name: 'initialize'
      docs: ['Admin', 'create global state']
      accounts: [
        {
          name: 'adminAccount'
          isMut: false
          isSigner: true
        },
        {
          name: 'globalState'
          isMut: true
          isSigner: false
        },
        {
          name: 'msolMintAccount'
          isMut: false
          isSigner: false
        },
        {
          name: 'foreman1'
          isMut: false
          isSigner: false
        },
        {
          name: 'foreman2'
          isMut: false
          isSigner: false
        }
      ]
      args: [
        {
          name: 'minKeepPct'
          type: 'u8'
        },
        {
          name: 'maxKeepPct'
          type: 'u8'
        }
      ]
    },
    {
      name: 'initReferralAccount'
      docs: ['create referral state']
      accounts: [
        {
          name: 'globalState'
          isMut: false
          isSigner: false
        },
        {
          name: 'signer'
          isMut: false
          isSigner: true
        },
        {
          name: 'referralState'
          isMut: true
          isSigner: false
        },
        {
          name: 'partnerAccount'
          isMut: false
          isSigner: false
        },
        {
          name: 'msolTokenPartnerAccount'
          isMut: false
          isSigner: false
        }
      ]
      args: [
        {
          name: 'partnerName'
          type: 'string'
        },
        {
          name: 'validatorVoteKey'
          type: {
            option: 'publicKey'
          }
        },
        {
          name: 'keepSelfStakePct'
          type: 'u8'
        }
      ]
    },
    {
      name: 'updateReferral'
      docs: ['update referral state']
      accounts: [
        {
          name: 'globalState'
          isMut: false
          isSigner: false
        },
        {
          name: 'adminAccount'
          isMut: false
          isSigner: true
        },
        {
          name: 'referralState'
          isMut: true
          isSigner: false
        },
        {
          name: 'newPartnerAccount'
          isMut: false
          isSigner: false
        },
        {
          name: 'newMsolTokenPartnerAccount'
          isMut: false
          isSigner: false
        }
      ]
      args: [
        {
          name: 'pause'
          type: 'bool'
        }
      ]
    },
    {
      name: 'updateOperationFees'
      docs: ['update referral operation fees']
      accounts: [
        {
          name: 'globalState'
          isMut: false
          isSigner: false
        },
        {
          name: 'signer'
          isMut: false
          isSigner: true
        },
        {
          name: 'referralState'
          isMut: true
          isSigner: false
        }
      ]
      args: [
        {
          name: 'operationDepositSolFee'
          type: {
            option: 'u8'
          }
        },
        {
          name: 'operationDepositStakeAccountFee'
          type: {
            option: 'u8'
          }
        },
        {
          name: 'operationLiquidUnstakeFee'
          type: {
            option: 'u8'
          }
        },
        {
          name: 'operationDelayedUnstakeFee'
          type: {
            option: 'u8'
          }
        }
      ]
    },
    {
      name: 'changeAuthority'
      docs: [
        'update partner, authority and beneficiary account based on the new partner'
      ]
      accounts: [
        {
          name: 'globalState'
          isMut: true
          isSigner: false
        },
        {
          name: 'adminAccount'
          isMut: false
          isSigner: true
        },
        {
          name: 'newAdminAccount'
          isMut: false
          isSigner: false
        },
        {
          name: 'newForeman1'
          isMut: false
          isSigner: false
        },
        {
          name: 'newForeman2'
          isMut: false
          isSigner: false
        }
      ]
      args: []
    },
    {
      name: 'adminRecognizeDeposit'
      docs: ['deposit SOL']
      accounts: [
        {
          name: 'signer'
          isMut: false
          isSigner: true
        },
        {
          name: 'globalState'
          isMut: false
          isSigner: false
        },
        {
          name: 'referralState'
          isMut: true
          isSigner: false
        }
      ]
      args: [
        {
          name: 'lamports'
          type: 'u64'
        }
      ]
    }
  ]
  accounts: [
    {
      name: 'globalState'
      docs: ['marinade-referral-program PDA']
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'adminAccount'
            type: 'publicKey'
          },
          {
            name: 'msolMintAccount'
            type: 'publicKey'
          },
          {
            name: 'foreman1'
            type: 'publicKey'
          },
          {
            name: 'foreman2'
            type: 'publicKey'
          },
          {
            name: 'minKeepPct'
            type: 'u8'
          },
          {
            name: 'maxKeepPct'
            type: 'u8'
          }
        ]
      }
    },
    {
      name: 'referralState'
      docs: ['referral PDA']
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'partnerName'
            type: 'string'
          },
          {
            name: 'validatorVoteKey'
            docs: [
              'set value if this referral-account is a stake-account-as-collateral partner record'
            ]
            type: {
              option: 'publicKey'
            }
          },
          {
            name: 'keepSelfStakePct'
            type: 'u8'
          },
          {
            name: 'partnerAccount'
            type: 'publicKey'
          },
          {
            name: 'msolTokenPartnerAccount'
            type: 'publicKey'
          },
          {
            name: 'depositSolAmount'
            type: 'u64'
          },
          {
            name: 'depositSolOperations'
            type: 'u64'
          },
          {
            name: 'depositStakeAccountAmount'
            type: 'u64'
          },
          {
            name: 'depositStakeAccountOperations'
            type: 'u64'
          },
          {
            name: 'liqUnstakeMsolFees'
            type: 'u64'
          },
          {
            name: 'liqUnstakeSolAmount'
            type: 'u64'
          },
          {
            name: 'liqUnstakeMsolAmount'
            type: 'u64'
          },
          {
            name: 'liqUnstakeOperations'
            type: 'u64'
          },
          {
            name: 'delayedUnstakeAmount'
            type: 'u64'
          },
          {
            name: 'delayedUnstakeOperations'
            type: 'u64'
          },
          {
            name: 'baseFee'
            type: 'u32'
          },
          {
            name: 'maxFee'
            type: 'u32'
          },
          {
            name: 'maxNetStake'
            type: 'u64'
          },
          {
            name: 'pause'
            type: 'bool'
          },
          {
            name: 'operationDepositSolFee'
            type: 'u8'
          },
          {
            name: 'operationDepositStakeAccountFee'
            type: 'u8'
          },
          {
            name: 'operationLiquidUnstakeFee'
            type: 'u8'
          },
          {
            name: 'operationDelayedUnstakeFee'
            type: 'u8'
          },
          {
            name: 'accumDepositSolFee'
            type: 'u64'
          },
          {
            name: 'accumDepositStakeAccountFee'
            type: 'u64'
          },
          {
            name: 'accumLiquidUnstakeFee'
            type: 'u64'
          },
          {
            name: 'accumDelayedUnstakeFee'
            type: 'u64'
          }
        ]
      }
    }
  ]
  types: [
    {
      name: 'ReferralError'
      type: {
        kind: 'enum'
        variants: [
          {
            name: 'AccessDenied'
          },
          {
            name: 'Paused'
          },
          {
            name: 'TransferNotAvailable'
          },
          {
            name: 'InvalidPartnerAccountOwner'
          },
          {
            name: 'InvalidPartnerAccountMint'
          },
          {
            name: 'PartnerNameTooLong'
          },
          {
            name: 'NotInitializedMintAccount'
          },
          {
            name: 'ReferralOperationFeeOverMax'
          },
          {
            name: 'NotAllowedForStakeAsCollateralPartner'
          },
          {
            name: 'KeepPctOutOfRange'
          },
          {
            name: 'MaxKeepPctOutOfRange'
          },
          {
            name: 'MinMaxKeepPctOutOfRange'
          },
          {
            name: 'StakeAccountMustBeDelegatedToPartnerValidator'
          },
          {
            name: 'StakeAccountAuthMustBePartnerAccount'
          },
          {
            name: 'OnlyAllowedForStakeAsCollateralPartner'
          },
          {
            name: 'InvalidGlobalAccount'
          }
        ]
      }
    }
  ]
}

export const IDL: MarinadeReferral = {
  version: '0.2.0',
  name: 'marinade_referral',
  instructions: [
    {
      name: 'deposit',
      docs: ['deposit SOL'],
      accounts: [
        {
          name: 'state',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'msolMint',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'liqPoolSolLegPda',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'liqPoolMsolLeg',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'liqPoolMsolLegAuthority',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'reservePda',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'transferFrom',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'mintTo',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'msolMintAuthority',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'marinadeFinanceProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'referralState',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'msolTokenPartnerAccount',
          isMut: true,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'lamports',
          type: 'u64',
        },
      ],
    },
    {
      name: 'depositStakeAccount',
      docs: ['deposit stake account'],
      accounts: [
        {
          name: 'state',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'validatorList',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'stakeList',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'stakeAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'stakeAuthority',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'duplicationFlag',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'rentPayer',
          isMut: true,
          isSigner: true,
        },
        {
          name: 'msolMint',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'mintTo',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'msolMintAuthority',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'clock',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'rent',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'stakeProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'marinadeFinanceProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'referralState',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'msolTokenPartnerAccount',
          isMut: true,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'validatorIndex',
          type: 'u32',
        },
      ],
    },
    {
      name: 'liquidUnstake',
      docs: ['liquid-unstake mSOL'],
      accounts: [
        {
          name: 'state',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'msolMint',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'liqPoolSolLegPda',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'liqPoolMsolLeg',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'treasuryMsolAccount',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'getMsolFrom',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'getMsolFromAuthority',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'transferSolTo',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'systemProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'tokenProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'marinadeFinanceProgram',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'referralState',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'msolTokenPartnerAccount',
          isMut: true,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'msolAmount',
          type: 'u64',
        },
      ],
    },
    {
      name: 'initialize',
      docs: ['Admin', 'create global state'],
      accounts: [
        {
          name: 'adminAccount',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'globalState',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'msolMintAccount',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'foreman1',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'foreman2',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'minKeepPct',
          type: 'u8',
        },
        {
          name: 'maxKeepPct',
          type: 'u8',
        },
      ],
    },
    {
      name: 'initReferralAccount',
      docs: ['create referral state'],
      accounts: [
        {
          name: 'globalState',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'signer',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'referralState',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'partnerAccount',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'msolTokenPartnerAccount',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'partnerName',
          type: 'string',
        },
        {
          name: 'validatorVoteKey',
          type: {
            option: 'publicKey',
          },
        },
        {
          name: 'keepSelfStakePct',
          type: 'u8',
        },
      ],
    },
    {
      name: 'updateReferral',
      docs: ['update referral state'],
      accounts: [
        {
          name: 'globalState',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'adminAccount',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'referralState',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'newPartnerAccount',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'newMsolTokenPartnerAccount',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'pause',
          type: 'bool',
        },
      ],
    },
    {
      name: 'updateOperationFees',
      docs: ['update referral operation fees'],
      accounts: [
        {
          name: 'globalState',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'signer',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'referralState',
          isMut: true,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'operationDepositSolFee',
          type: {
            option: 'u8',
          },
        },
        {
          name: 'operationDepositStakeAccountFee',
          type: {
            option: 'u8',
          },
        },
        {
          name: 'operationLiquidUnstakeFee',
          type: {
            option: 'u8',
          },
        },
        {
          name: 'operationDelayedUnstakeFee',
          type: {
            option: 'u8',
          },
        },
      ],
    },
    {
      name: 'changeAuthority',
      docs: [
        'update partner, authority and beneficiary account based on the new partner',
      ],
      accounts: [
        {
          name: 'globalState',
          isMut: true,
          isSigner: false,
        },
        {
          name: 'adminAccount',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'newAdminAccount',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'newForeman1',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'newForeman2',
          isMut: false,
          isSigner: false,
        },
      ],
      args: [],
    },
    {
      name: 'adminRecognizeDeposit',
      docs: ['deposit SOL'],
      accounts: [
        {
          name: 'signer',
          isMut: false,
          isSigner: true,
        },
        {
          name: 'globalState',
          isMut: false,
          isSigner: false,
        },
        {
          name: 'referralState',
          isMut: true,
          isSigner: false,
        },
      ],
      args: [
        {
          name: 'lamports',
          type: 'u64',
        },
      ],
    },
  ],
  accounts: [
    {
      name: 'globalState',
      docs: ['marinade-referral-program PDA'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'adminAccount',
            type: 'publicKey',
          },
          {
            name: 'msolMintAccount',
            type: 'publicKey',
          },
          {
            name: 'foreman1',
            type: 'publicKey',
          },
          {
            name: 'foreman2',
            type: 'publicKey',
          },
          {
            name: 'minKeepPct',
            type: 'u8',
          },
          {
            name: 'maxKeepPct',
            type: 'u8',
          },
        ],
      },
    },
    {
      name: 'referralState',
      docs: ['referral PDA'],
      type: {
        kind: 'struct',
        fields: [
          {
            name: 'partnerName',
            type: 'string',
          },
          {
            name: 'validatorVoteKey',
            docs: [
              'set value if this referral-account is a stake-account-as-collateral partner record',
            ],
            type: {
              option: 'publicKey',
            },
          },
          {
            name: 'keepSelfStakePct',
            type: 'u8',
          },
          {
            name: 'partnerAccount',
            type: 'publicKey',
          },
          {
            name: 'msolTokenPartnerAccount',
            type: 'publicKey',
          },
          {
            name: 'depositSolAmount',
            type: 'u64',
          },
          {
            name: 'depositSolOperations',
            type: 'u64',
          },
          {
            name: 'depositStakeAccountAmount',
            type: 'u64',
          },
          {
            name: 'depositStakeAccountOperations',
            type: 'u64',
          },
          {
            name: 'liqUnstakeMsolFees',
            type: 'u64',
          },
          {
            name: 'liqUnstakeSolAmount',
            type: 'u64',
          },
          {
            name: 'liqUnstakeMsolAmount',
            type: 'u64',
          },
          {
            name: 'liqUnstakeOperations',
            type: 'u64',
          },
          {
            name: 'delayedUnstakeAmount',
            type: 'u64',
          },
          {
            name: 'delayedUnstakeOperations',
            type: 'u64',
          },
          {
            name: 'baseFee',
            type: 'u32',
          },
          {
            name: 'maxFee',
            type: 'u32',
          },
          {
            name: 'maxNetStake',
            type: 'u64',
          },
          {
            name: 'pause',
            type: 'bool',
          },
          {
            name: 'operationDepositSolFee',
            type: 'u8',
          },
          {
            name: 'operationDepositStakeAccountFee',
            type: 'u8',
          },
          {
            name: 'operationLiquidUnstakeFee',
            type: 'u8',
          },
          {
            name: 'operationDelayedUnstakeFee',
            type: 'u8',
          },
          {
            name: 'accumDepositSolFee',
            type: 'u64',
          },
          {
            name: 'accumDepositStakeAccountFee',
            type: 'u64',
          },
          {
            name: 'accumLiquidUnstakeFee',
            type: 'u64',
          },
          {
            name: 'accumDelayedUnstakeFee',
            type: 'u64',
          },
        ],
      },
    },
  ],
  types: [
    {
      name: 'ReferralError',
      type: {
        kind: 'enum',
        variants: [
          {
            name: 'AccessDenied',
          },
          {
            name: 'Paused',
          },
          {
            name: 'TransferNotAvailable',
          },
          {
            name: 'InvalidPartnerAccountOwner',
          },
          {
            name: 'InvalidPartnerAccountMint',
          },
          {
            name: 'PartnerNameTooLong',
          },
          {
            name: 'NotInitializedMintAccount',
          },
          {
            name: 'ReferralOperationFeeOverMax',
          },
          {
            name: 'NotAllowedForStakeAsCollateralPartner',
          },
          {
            name: 'KeepPctOutOfRange',
          },
          {
            name: 'MaxKeepPctOutOfRange',
          },
          {
            name: 'MinMaxKeepPctOutOfRange',
          },
          {
            name: 'StakeAccountMustBeDelegatedToPartnerValidator',
          },
          {
            name: 'StakeAccountAuthMustBePartnerAccount',
          },
          {
            name: 'OnlyAllowedForStakeAsCollateralPartner',
          },
          {
            name: 'InvalidGlobalAccount',
          },
        ],
      },
    },
  ],
}
