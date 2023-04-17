import { web3 } from "@coral-xyz/anchor"

export namespace MarinadeFinanceIdl {
  export namespace Instruction {
    export namespace Initialize {
      export type Accounts = {
        creatorAuthority: web3.PublicKey;
        state: web3.PublicKey;
        reservePda: web3.PublicKey;
        stakeList: web3.PublicKey;
        validatorList: web3.PublicKey;
        msolMint: web3.PublicKey;
        operationalSolAccount: web3.PublicKey;
        liqPool: web3.PublicKey;
        treasuryMsolAccount: web3.PublicKey;
        clock: web3.PublicKey;
        rent: web3.PublicKey;
      };
    }
    export namespace ChangeAuthority {
      export type Accounts = {
        state: web3.PublicKey;
        adminAuthority: web3.PublicKey;
      };
    }
    export namespace AddValidator {
      export type Accounts = {
        state: web3.PublicKey;
        managerAuthority: web3.PublicKey;
        validatorList: web3.PublicKey;
        validatorVote: web3.PublicKey;
        duplicationFlag: web3.PublicKey;
        rentPayer: web3.PublicKey;
        clock: web3.PublicKey;
        rent: web3.PublicKey;
        systemProgram: web3.PublicKey;
      };
    }
    export namespace RemoveValidator {
      export type Accounts = {
        state: web3.PublicKey;
        managerAuthority: web3.PublicKey;
        validatorList: web3.PublicKey;
        duplicationFlag: web3.PublicKey;
        operationalSolAccount: web3.PublicKey;
      };
    }
    export namespace SetValidatorScore {
      export type Accounts = {
        state: web3.PublicKey;
        managerAuthority: web3.PublicKey;
        validatorList: web3.PublicKey;
      };
    }
    export namespace ConfigValidatorSystem {
      export type Accounts = {
        state: web3.PublicKey;
        managerAuthority: web3.PublicKey;
      };
    }
    export namespace Deposit {
      export type Accounts = {
        state: web3.PublicKey;
        msolMint: web3.PublicKey;
        liqPoolSolLegPda: web3.PublicKey;
        liqPoolMsolLeg: web3.PublicKey;
        liqPoolMsolLegAuthority: web3.PublicKey;
        reservePda: web3.PublicKey;
        transferFrom: web3.PublicKey;
        mintTo: web3.PublicKey;
        msolMintAuthority: web3.PublicKey;
        systemProgram: web3.PublicKey;
        tokenProgram: web3.PublicKey;
      };
    }
    export namespace DepositStakeAccount {
      export type Accounts = {
        state: web3.PublicKey;
        validatorList: web3.PublicKey;
        stakeList: web3.PublicKey;
        stakeAccount: web3.PublicKey;
        stakeAuthority: web3.PublicKey;
        duplicationFlag: web3.PublicKey;
        rentPayer: web3.PublicKey;
        msolMint: web3.PublicKey;
        mintTo: web3.PublicKey;
        msolMintAuthority: web3.PublicKey;
        clock: web3.PublicKey;
        rent: web3.PublicKey;
        systemProgram: web3.PublicKey;
        tokenProgram: web3.PublicKey;
        stakeProgram: web3.PublicKey;
      };
    }
    export namespace LiquidUnstake {
      export type Accounts = {
        state: web3.PublicKey;
        msolMint: web3.PublicKey;
        liqPoolSolLegPda: web3.PublicKey;
        liqPoolMsolLeg: web3.PublicKey;
        treasuryMsolAccount: web3.PublicKey;
        getMsolFrom: web3.PublicKey;
        getMsolFromAuthority: web3.PublicKey;
        transferSolTo: web3.PublicKey;
        systemProgram: web3.PublicKey;
        tokenProgram: web3.PublicKey;
      };
    }
    export namespace AddLiquidity {
      export type Accounts = {
        state: web3.PublicKey;
        lpMint: web3.PublicKey;
        lpMintAuthority: web3.PublicKey;
        liqPoolMsolLeg: web3.PublicKey;
        liqPoolSolLegPda: web3.PublicKey;
        transferFrom: web3.PublicKey;
        mintTo: web3.PublicKey;
        systemProgram: web3.PublicKey;
        tokenProgram: web3.PublicKey;
      };
    }
    export namespace RemoveLiquidity {
      export type Accounts = {
        state: web3.PublicKey;
        lpMint: web3.PublicKey;
        burnFrom: web3.PublicKey;
        burnFromAuthority: web3.PublicKey;
        transferSolTo: web3.PublicKey;
        transferMsolTo: web3.PublicKey;
        liqPoolSolLegPda: web3.PublicKey;
        liqPoolMsolLeg: web3.PublicKey;
        liqPoolMsolLegAuthority: web3.PublicKey;
        systemProgram: web3.PublicKey;
        tokenProgram: web3.PublicKey;
      };
    }
    export namespace ConfigLp {
      export type Accounts = {
        state: web3.PublicKey;
        adminAuthority: web3.PublicKey;
      };
    }
    export namespace ConfigMarinade {
      export type Accounts = {
        state: web3.PublicKey;
        adminAuthority: web3.PublicKey;
      };
    }
    export namespace OrderUnstake {
      export type Accounts = {
        state: web3.PublicKey;
        msolMint: web3.PublicKey;
        burnMsolFrom: web3.PublicKey;
        burnMsolAuthority: web3.PublicKey;
        newTicketAccount: web3.PublicKey;
        clock: web3.PublicKey;
        rent: web3.PublicKey;
        tokenProgram: web3.PublicKey;
      };
    }
    export namespace Claim {
      export type Accounts = {
        state: web3.PublicKey;
        reservePda: web3.PublicKey;
        ticketAccount: web3.PublicKey;
        transferSolTo: web3.PublicKey;
        clock: web3.PublicKey;
        systemProgram: web3.PublicKey;
      };
    }
    export namespace StakeReserve {
      export type Accounts = {
        state: web3.PublicKey;
        validatorList: web3.PublicKey;
        stakeList: web3.PublicKey;
        validatorVote: web3.PublicKey;
        reservePda: web3.PublicKey;
        stakeAccount: web3.PublicKey;
        stakeDepositAuthority: web3.PublicKey;
        clock: web3.PublicKey;
        epochSchedule: web3.PublicKey;
        rent: web3.PublicKey;
        stakeHistory: web3.PublicKey;
        stakeConfig: web3.PublicKey;
        systemProgram: web3.PublicKey;
        stakeProgram: web3.PublicKey;
      };
    }
    export namespace UpdateActive {
      export type Accounts = {
        common: web3.PublicKey;
        validatorList: web3.PublicKey;
      };
    }
    export namespace UpdateDeactivated {
      export type Accounts = {
        common: web3.PublicKey;
        operationalSolAccount: web3.PublicKey;
        systemProgram: web3.PublicKey;
      };
    }
    export namespace DeactivateStake {
      export type Accounts = {
        state: web3.PublicKey;
        reservePda: web3.PublicKey;
        validatorList: web3.PublicKey;
        stakeList: web3.PublicKey;
        stakeAccount: web3.PublicKey;
        stakeDepositAuthority: web3.PublicKey;
        splitStakeAccount: web3.PublicKey;
        splitStakeRentPayer: web3.PublicKey;
        clock: web3.PublicKey;
        rent: web3.PublicKey;
        epochSchedule: web3.PublicKey;
        stakeHistory: web3.PublicKey;
        systemProgram: web3.PublicKey;
        stakeProgram: web3.PublicKey;
      };
    }
    export namespace EmergencyUnstake {
      export type Accounts = {
        state: web3.PublicKey;
        validatorManagerAuthority: web3.PublicKey;
        validatorList: web3.PublicKey;
        stakeList: web3.PublicKey;
        stakeAccount: web3.PublicKey;
        stakeDepositAuthority: web3.PublicKey;
        clock: web3.PublicKey;
        stakeProgram: web3.PublicKey;
      };
    }
    export namespace PartialUnstake {
      export type Accounts = {
        state: web3.PublicKey;
        validatorManagerAuthority: web3.PublicKey;
        validatorList: web3.PublicKey;
        stakeList: web3.PublicKey;
        stakeAccount: web3.PublicKey;
        stakeDepositAuthority: web3.PublicKey;
        reservePda: web3.PublicKey;
        splitStakeAccount: web3.PublicKey;
        splitStakeRentPayer: web3.PublicKey;
        clock: web3.PublicKey;
        rent: web3.PublicKey;
        stakeHistory: web3.PublicKey;
        systemProgram: web3.PublicKey;
        stakeProgram: web3.PublicKey;
      };
    }
    export namespace MergeStakes {
      export type Accounts = {
        state: web3.PublicKey;
        stakeList: web3.PublicKey;
        validatorList: web3.PublicKey;
        destinationStake: web3.PublicKey;
        sourceStake: web3.PublicKey;
        stakeDepositAuthority: web3.PublicKey;
        stakeWithdrawAuthority: web3.PublicKey;
        operationalSolAccount: web3.PublicKey;
        clock: web3.PublicKey;
        stakeHistory: web3.PublicKey;
        stakeProgram: web3.PublicKey;
      };
    }
  }
}
