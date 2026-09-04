import { BN, web3 } from '@coral-xyz/anchor'
import {
  newStakeAccountBalanceAlignmentInstructions,
  stakeAccountBalanceAlignmentInstructions,
} from './stake-account-helpers'
import { ParsedStakeAccountInfo } from './anchor.types'
import { U64_MAX } from './anchor'

const FROZEN_RENT_EXEMPT_RESERVE = new BN(2_282_880)
const LIVE_RENT = 2_077_224
const RENT_GAP = FROZEN_RENT_EXEMPT_RESERVE.subn(LIVE_RENT)
const STAKED = new BN(42).mul(new BN(web3.LAMPORTS_PER_SOL))
const CURRENT_EPOCH = 1030

const STAKE_ACCOUNT = web3.Keypair.generate().publicKey
const OWNER = web3.Keypair.generate().publicKey

function stakeAccountInfo(
  overrides: Partial<ParsedStakeAccountInfo> = {}
): ParsedStakeAccountInfo {
  return {
    address: STAKE_ACCOUNT,
    ownerAddress: web3.StakeProgram.programId,
    authorizedStakerAddress: OWNER,
    authorizedWithdrawerAddress: OWNER,
    voterAddress: web3.Keypair.generate().publicKey,
    activationEpoch: new BN(1000),
    deactivationEpoch: U64_MAX,
    isCoolingDown: false,
    isLockedUp: false,
    balanceLamports: STAKED.add(FROZEN_RENT_EXEMPT_RESERVE),
    stakedLamports: STAKED,
    rentExemptReserveLamports: FROZEN_RENT_EXEMPT_RESERVE,
    ...overrides,
  }
}

function transferredLamports(ix: web3.TransactionInstruction): BN {
  expect(ix.programId).toEqual(web3.SystemProgram.programId)
  const { lamports, fromPubkey, toPubkey } =
    web3.SystemInstruction.decodeTransfer(ix)
  expect(fromPubkey).toEqual(OWNER)
  expect(toPubkey).toEqual(STAKE_ACCOUNT)
  return new BN(lamports.toString())
}

function withdrawnLamports(ix: web3.TransactionInstruction): BN {
  expect(ix.programId).toEqual(web3.StakeProgram.programId)
  const { lamports, stakePubkey, toPubkey } =
    web3.StakeInstruction.decodeWithdraw(ix)
  expect(stakePubkey).toEqual(STAKE_ACCOUNT)
  expect(toPubkey).toEqual(OWNER)
  return new BN(lamports.toString())
}

describe('stakeAccountBalanceAlignmentInstructions', () => {
  it('tops up an account delegated at the reduced rent', () => {
    const instructions = stakeAccountBalanceAlignmentInstructions(
      stakeAccountInfo({ balanceLamports: STAKED.addn(LIVE_RENT) }),
      OWNER,
      CURRENT_EPOCH,
      LIVE_RENT
    )

    expect(instructions).toHaveLength(1)
    expect(transferredLamports(instructions[0])).toEqual(RENT_GAP)
  })

  it('does nothing for an account delegated before the rent reduction', () => {
    const instructions = stakeAccountBalanceAlignmentInstructions(
      stakeAccountInfo(),
      OWNER,
      CURRENT_EPOCH,
      LIVE_RENT
    )

    expect(instructions).toHaveLength(0)
  })

  it('withdraws the surplus down to the frozen reserve, not down to the live rent', () => {
    const surplus = new BN(3 * web3.LAMPORTS_PER_SOL)
    const instructions = stakeAccountBalanceAlignmentInstructions(
      stakeAccountInfo({
        balanceLamports: STAKED.add(FROZEN_RENT_EXEMPT_RESERVE).add(surplus),
      }),
      OWNER,
      CURRENT_EPOCH,
      LIVE_RENT
    )

    expect(instructions).toHaveLength(1)
    expect(withdrawnLamports(instructions[0])).toEqual(surplus)
  })

  it('tops up the rent gap of a cooled down account that gets re-delegated', () => {
    const instructions = stakeAccountBalanceAlignmentInstructions(
      stakeAccountInfo({
        isCoolingDown: true,
        deactivationEpoch: new BN(CURRENT_EPOCH - 1),
      }),
      OWNER,
      CURRENT_EPOCH,
      LIVE_RENT
    )

    expect(instructions).toHaveLength(1)
    expect(transferredLamports(instructions[0])).toEqual(RENT_GAP)
  })

  it('keeps the delegated amount of an account deactivated within the current epoch', () => {
    const instructions = stakeAccountBalanceAlignmentInstructions(
      stakeAccountInfo({
        isCoolingDown: true,
        deactivationEpoch: new BN(CURRENT_EPOCH),
      }),
      OWNER,
      CURRENT_EPOCH,
      LIVE_RENT
    )

    expect(instructions).toHaveLength(0)
  })

  it('fails when the stake account balance data is not available', () => {
    expect(() =>
      stakeAccountBalanceAlignmentInstructions(
        stakeAccountInfo({ rentExemptReserveLamports: null }),
        OWNER,
        CURRENT_EPOCH,
        LIVE_RENT
      )
    ).toThrow('Failed to read balance data of the stake account')
  })
})

describe('newStakeAccountBalanceAlignmentInstructions', () => {
  function creationInstructions(lamports: number) {
    return [
      web3.SystemProgram.createAccount({
        fromPubkey: OWNER,
        newAccountPubkey: STAKE_ACCOUNT,
        lamports,
        space: web3.StakeProgram.space,
        programId: web3.StakeProgram.programId,
      }),
    ]
  }

  it('tops up an account pre-funded with the reduced rent', () => {
    const instructions = newStakeAccountBalanceAlignmentInstructions(
      creationInstructions(LIVE_RENT),
      STAKE_ACCOUNT,
      OWNER
    )

    expect(instructions).toHaveLength(1)
    expect(transferredLamports(instructions[0])).toEqual(RENT_GAP)
  })

  it('does nothing for an account pre-funded with the frozen reserve', () => {
    const instructions = newStakeAccountBalanceAlignmentInstructions(
      creationInstructions(FROZEN_RENT_EXEMPT_RESERVE.toNumber()),
      STAKE_ACCOUNT,
      OWNER
    )

    expect(instructions).toHaveLength(0)
  })

  it('fails when the stake account is not created by the given instructions', () => {
    expect(() =>
      newStakeAccountBalanceAlignmentInstructions(
        creationInstructions(LIVE_RENT),
        web3.Keypair.generate().publicKey,
        OWNER
      )
    ).toThrow('Failed to find the creation of the stake account')
  })
})
