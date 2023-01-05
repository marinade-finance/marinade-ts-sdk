import { web3 } from '@project-serum/anchor'

export namespace MarinadeReferralIdl {
  export namespace Instruction {
    export namespace Deposit {
      export type Accounts = {
        state: web3.PublicKey
        msolMint: web3.PublicKey
        liqPoolSolLegPda: web3.PublicKey
        liqPoolMsolLeg: web3.PublicKey
        liqPoolMsolLegAuthority: web3.PublicKey
        reservePda: web3.PublicKey
        transferFrom: web3.PublicKey
        mintTo: web3.PublicKey
        msolMintAuthority: web3.PublicKey
        systemProgram: web3.PublicKey
        tokenProgram: web3.PublicKey
        marinadeFinanceProgram: web3.PublicKey
        referralState: web3.PublicKey
        msolTokenPartnerAccount: web3.PublicKey
      }
    }
    export namespace DepositStakeAccount {
      export type Accounts = {
        state: web3.PublicKey
        validatorList: web3.PublicKey
        stakeList: web3.PublicKey
        stakeAccount: web3.PublicKey
        stakeAuthority: web3.PublicKey
        duplicationFlag: web3.PublicKey
        rentPayer: web3.PublicKey
        msolMint: web3.PublicKey
        mintTo: web3.PublicKey
        msolMintAuthority: web3.PublicKey
        clock: web3.PublicKey
        rent: web3.PublicKey
        systemProgram: web3.PublicKey
        tokenProgram: web3.PublicKey
        stakeProgram: web3.PublicKey
        marinadeFinanceProgram: web3.PublicKey
        referralState: web3.PublicKey
        msolTokenPartnerAccount: web3.PublicKey
      }
    }
    export namespace LiquidUnstake {
      export type Accounts = {
        state: web3.PublicKey
        msolMint: web3.PublicKey
        liqPoolSolLegPda: web3.PublicKey
        liqPoolMsolLeg: web3.PublicKey
        treasuryMsolAccount: web3.PublicKey
        getMsolFrom: web3.PublicKey
        getMsolFromAuthority: web3.PublicKey
        transferSolTo: web3.PublicKey
        systemProgram: web3.PublicKey
        tokenProgram: web3.PublicKey
        marinadeFinanceProgram: web3.PublicKey
        referralState: web3.PublicKey
        msolTokenPartnerAccount: web3.PublicKey
      }
    }
    export namespace OrderUnstake {
      export type Accounts = {
        state: web3.PublicKey
        msolMint: web3.PublicKey
        burnMsolFrom: web3.PublicKey
        burnMsolAuthority: web3.PublicKey
        newTicketAccount: web3.PublicKey
        clock: web3.PublicKey
        rent: web3.PublicKey
        tokenProgram: web3.PublicKey
        msolTokenPartnerAccount: web3.PublicKey
      }
    }
    export namespace Claim {
      export type Accounts = {
        state: web3.PublicKey
        reservePda: web3.PublicKey
        ticketAccount: web3.PublicKey
        transferSolTo: web3.PublicKey
        clock: web3.PublicKey
        systemProgram: web3.PublicKey
      }
    }
    export namespace Initialize {
      export type Accounts = {
        adminAccount: web3.PublicKey
        globalState: web3.PublicKey
        msolMintAccount: web3.PublicKey
        foreman1: web3.PublicKey
        foreman2: web3.PublicKey
      }
    }
    export namespace InitReferralAccount {
      export type Accounts = {
        globalState: web3.PublicKey
        signer: web3.PublicKey
        referralState: web3.PublicKey
        partnerAccount: web3.PublicKey
        msolTokenPartnerAccount: web3.PublicKey
      }
    }
    export namespace UpdateReferral {
      export type Accounts = {
        globalState: web3.PublicKey
        adminAccount: web3.PublicKey
        referralState: web3.PublicKey
        newPartnerAccount: web3.PublicKey
        newMsolTokenPartnerAccount: web3.PublicKey
      }
    }
    export namespace UpdateOperationFees {
      export type Accounts = {
        globalState: web3.PublicKey
        signer: web3.PublicKey
        referralState: web3.PublicKey
      }
    }
    export namespace ChangeAuthority {
      export type Accounts = {
        globalState: web3.PublicKey
        adminAccount: web3.PublicKey
        newAdminAccount: web3.PublicKey
        newForeman1: web3.PublicKey
        newForeman2: web3.PublicKey
      }
    }
  }
}
