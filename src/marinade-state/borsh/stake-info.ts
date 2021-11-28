import BN from 'bn.js'
import {StakeRecord} from "./stake-record";
import {StakeState} from "./stake-state";

export class StakeInfo {
  index!: number
  record!: StakeRecord
  stake!: StakeState
  balance!: BN

  constructor(args: StakeInfo) {
    Object.assign(this, args)
  }
}
