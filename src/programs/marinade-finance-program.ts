import bs58 from 'bs58'
import { BN, Program, web3, Provider, Idl } from '@project-serum/anchor'
import { MarinadeFinanceIdl } from './idl/marinade-finance-idl'
import * as marinadeFinanceIdlSchema from './idl/marinade-finance-idl.json'
import { MarinadeState } from '../marinade-state/marinade-state'
import { STAKE_PROGRAM_ID, SYSTEM_PROGRAM_ID, getEpochInfo, getTicketDateInfo } from '../util'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { SYSVAR_CLOCK_PUBKEY, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { MARINADE_BORSH_SCHEMA } from '../marinade-state/borsh'
import { deserializeUnchecked } from 'borsh'
import { TicketAccount } from '../marinade-state/borsh/ticket-account'

export class MarinadeFinanceProgram {
  constructor(
    public readonly programAddress: web3.PublicKey,
    public readonly anchorProvider: Provider,
  ) { }

  get program(): Program {
    return new Program(
      marinadeFinanceIdlSchema as Idl,
      this.programAddress,
      this.anchorProvider,
    )
  }

  async getDelayedUnstakeTickets(beneficiary?: web3.PublicKey): Promise<Map<web3.PublicKey, TicketAccount>> {
    const discriminator = bs58.encode(Uint8Array.from([0x85, 0x4d, 0x12, 0x62]))

    const filters = [
      {
        dataSize: 88,
      },
      {
        memcmp: {
          offset: 0,
          bytes: discriminator,
        },
      },
    ]

    if (beneficiary) {
      filters.push({
        memcmp: {
          offset: 8 + 32,
          bytes: beneficiary.toBase58(),
        },
      })
    }

    const ticketAccountInfos = await this.anchorProvider.connection.getProgramAccounts(this.programAddress, { filters })
    const epochInfo = await getEpochInfo(this.anchorProvider.connection)
   

    return new Map(ticketAccountInfos.map((ticketAccountInfo) => {
      const { data } = ticketAccountInfo.account
      const ticketAccount = deserializeUnchecked(
        MARINADE_BORSH_SCHEMA,
        TicketAccount,
        data.slice(8, data.length),
      )

      const ticketDateInfo = getTicketDateInfo(epochInfo,ticketAccount.createdEpoch.toNumber(), Date.now())
      
      return [
        ticketAccountInfo.pubkey,
        {...ticketAccount,...ticketDateInfo },
      ]
    }))
  }

  addLiquidityInstructionAccounts = async({ marinadeState, ownerAddress, associatedLPTokenAccountAddress }: {
    marinadeState: MarinadeState,
    ownerAddress: web3.PublicKey,
    associatedLPTokenAccountAddress: web3.PublicKey,
  }): Promise<MarinadeFinanceIdl.Instruction.AddLiquidity.Accounts> => ({
    state: marinadeState.marinadeStateAddress,
    lpMint: marinadeState.lpMintAddress,
    lpMintAuthority: await marinadeState.lpMintAuthority(),
    liqPoolMsolLeg: marinadeState.mSolLeg,
    liqPoolSolLegPda: await marinadeState.solLeg(),
    transferFrom: ownerAddress,
    mintTo: associatedLPTokenAccountAddress,
    systemProgram: SYSTEM_PROGRAM_ID,
    tokenProgram: TOKEN_PROGRAM_ID,
  })

  addLiquidityInstruction = ({ accounts, amountLamports }: {
    accounts: MarinadeFinanceIdl.Instruction.AddLiquidity.Accounts,
    amountLamports: BN,
  }): web3.TransactionInstruction => this.program.instruction.addLiquidity(
    amountLamports,
    { accounts }
  )

  removeLiquidityInstructionAccounts = async({ marinadeState, ownerAddress, associatedLPTokenAccountAddress, associatedMSolTokenAccountAddress }: {
    marinadeState: MarinadeState,
    ownerAddress: web3.PublicKey,
    associatedLPTokenAccountAddress: web3.PublicKey,
    associatedMSolTokenAccountAddress: web3.PublicKey,
  }): Promise<MarinadeFinanceIdl.Instruction.RemoveLiquidity.Accounts> => ({
    state: marinadeState.marinadeStateAddress,
    lpMint: marinadeState.lpMintAddress,
    burnFrom: associatedLPTokenAccountAddress,
    burnFromAuthority: ownerAddress,
    liqPoolSolLegPda: await marinadeState.solLeg(),
    transferSolTo: ownerAddress,
    transferMsolTo: associatedMSolTokenAccountAddress,
    liqPoolMsolLeg: marinadeState.mSolLeg,
    liqPoolMsolLegAuthority: await marinadeState.mSolLegAuthority(),
    systemProgram: SYSTEM_PROGRAM_ID,
    tokenProgram: TOKEN_PROGRAM_ID,
  })

  removeLiquidityInstruction = ({ accounts, amountLamports }: {
    accounts: MarinadeFinanceIdl.Instruction.RemoveLiquidity.Accounts,
    amountLamports: BN,
  }): web3.TransactionInstruction => this.program.instruction.removeLiquidity(
    amountLamports,
    { accounts }
  )

  liquidUnstakeInstructionAccounts = async({ marinadeState, ownerAddress, associatedMSolTokenAccountAddress }: {
    marinadeState: MarinadeState,
    ownerAddress: web3.PublicKey,
    associatedMSolTokenAccountAddress: web3.PublicKey,
  }): Promise<MarinadeFinanceIdl.Instruction.LiquidUnstake.Accounts> => ({
    state: marinadeState.marinadeStateAddress,
    msolMint: marinadeState.mSolMintAddress,
    liqPoolMsolLeg: marinadeState.mSolLeg,
    liqPoolSolLegPda: await marinadeState.solLeg(),
    getMsolFrom: associatedMSolTokenAccountAddress,
    getMsolFromAuthority: ownerAddress,
    transferSolTo: ownerAddress,
    treasuryMsolAccount: marinadeState.treasuryMsolAccount,
    systemProgram: SYSTEM_PROGRAM_ID,
    tokenProgram: TOKEN_PROGRAM_ID,
  })

  liquidUnstakeInstruction = ({ accounts, amountLamports }: {
    accounts: MarinadeFinanceIdl.Instruction.LiquidUnstake.Accounts,
    amountLamports: BN,
  }): web3.TransactionInstruction => this.program.instruction.liquidUnstake(
    amountLamports,
    { accounts }
  )

  liquidUnstakeInstructionBuilder = async({ amountLamports, ...accountsArgs }: { amountLamports: BN } & Parameters<this['liquidUnstakeInstructionAccounts']>[0]) =>
    this.liquidUnstakeInstruction({
      amountLamports,
      accounts: await this.liquidUnstakeInstructionAccounts(accountsArgs),
    })

  depositInstructionAccounts = async({ marinadeState, transferFrom, associatedMSolTokenAccountAddress }: {
    marinadeState: MarinadeState,
    transferFrom: web3.PublicKey,
    associatedMSolTokenAccountAddress: web3.PublicKey,
  }): Promise<MarinadeFinanceIdl.Instruction.Deposit.Accounts> => ({
    reservePda: await marinadeState.reserveAddress(),
    state: marinadeState.marinadeStateAddress,
    msolMint: marinadeState.mSolMintAddress,
    msolMintAuthority: await marinadeState.mSolMintAuthority(),
    liqPoolMsolLegAuthority: await marinadeState.mSolLegAuthority(),
    liqPoolMsolLeg: marinadeState.mSolLeg,
    liqPoolSolLegPda: await marinadeState.solLeg(),
    mintTo: associatedMSolTokenAccountAddress,
    transferFrom,
    systemProgram: SYSTEM_PROGRAM_ID,
    tokenProgram: TOKEN_PROGRAM_ID,
  })

  depositInstruction = ({ accounts, amountLamports }: {
    accounts: MarinadeFinanceIdl.Instruction.Deposit.Accounts,
    amountLamports: BN,
  }): web3.TransactionInstruction => this.program.instruction.deposit(
    amountLamports,
    { accounts }
  )

  depositInstructionBuilder = async({ amountLamports, ...accountsArgs }: { amountLamports: BN } & Parameters<this['depositInstructionAccounts']>[0]) =>
    this.depositInstruction({
      amountLamports,
      accounts: await this.depositInstructionAccounts(accountsArgs),
    })

  depositStakeAccountInstructionAccounts = async({
    marinadeState,
    duplicationFlag,
    ownerAddress,
    stakeAccountAddress,
    authorizedWithdrawerAddress,
    associatedMSolTokenAccountAddress,
  }: {
    marinadeState: MarinadeState,
    duplicationFlag: web3.PublicKey,
    ownerAddress: web3.PublicKey,
    stakeAccountAddress: web3.PublicKey,
    authorizedWithdrawerAddress: web3.PublicKey,
    associatedMSolTokenAccountAddress: web3.PublicKey,
  }): Promise<MarinadeFinanceIdl.Instruction.DepositStakeAccount.Accounts> => ({
    duplicationFlag,
    stakeAuthority: authorizedWithdrawerAddress,
    state: marinadeState.marinadeStateAddress,
    stakeList: marinadeState.state.stakeSystem.stakeList.account,
    stakeAccount: stakeAccountAddress,
    validatorList: marinadeState.state.validatorSystem.validatorList.account,
    msolMint: marinadeState.mSolMintAddress,
    msolMintAuthority: await marinadeState.mSolMintAuthority(),
    mintTo: associatedMSolTokenAccountAddress,
    rentPayer: ownerAddress,
    clock: SYSVAR_CLOCK_PUBKEY,
    rent: SYSVAR_RENT_PUBKEY,
    systemProgram: SYSTEM_PROGRAM_ID,
    tokenProgram: TOKEN_PROGRAM_ID,
    stakeProgram: STAKE_PROGRAM_ID,
  })

  depositStakeAccountInstruction = ({ accounts, validatorIndex }: {
    accounts: MarinadeFinanceIdl.Instruction.DepositStakeAccount.Accounts,
    validatorIndex: number,
  }): web3.TransactionInstruction => this.program.instruction.depositStakeAccount(
    validatorIndex,
    { accounts },
  )

  depositStakeAccountInstructionBuilder = async({ validatorIndex, ...accountsArgs }: { validatorIndex: number } & Parameters<this['depositStakeAccountInstructionAccounts']>[0]) =>
    this.depositStakeAccountInstruction({
      validatorIndex,
      accounts: await this.depositStakeAccountInstructionAccounts(accountsArgs),
    })
}
