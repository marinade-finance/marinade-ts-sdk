#!/usr/bin/env node

const fs = require('fs')
const rawInput = fs.readFileSync(0, 'utf-8')
const parsedInput = JSON.parse(rawInput)

const capitalize = (str) => str.replace(/^[a-z]/, (match) => match.toUpperCase())
const snakeCase2camelCase = (str) => str.toLowerCase().replace(/([-_][a-z])/g, (match) => match.slice(-1).toUpperCase())

const buildIdlNamespaceName = (idl) => `${capitalize(snakeCase2camelCase(idl.name))}Idl`

const buildIdlAccountAddressField = (account) => `${account.name}: web3.PublicKey`

const buildIdlInstructionAccountsType = (instruction) => [
  `export type Accounts = {`,
  instruction.accounts.map(buildIdlAccountAddressField),
  `}`
]

const buildIdlInstructionNamespace = (instruction) => [
  `export namespace ${capitalize(instruction.name)} {`,
  buildIdlInstructionAccountsType(instruction),
  `}`
]

const buildIdlInstructionsNamespace = (instructions) => [
  `export namespace Instruction {`,
  instructions.map(buildIdlInstructionNamespace).flat(),
  `}`
]

const buildIdlNamespace = (idl) => [
  `import { web3 } from '@project-serum/anchor'`,
  ``,
  `export namespace ${buildIdlNamespaceName(idl)} {`,
  buildIdlInstructionsNamespace(idl.instructions),
  `}`,
]

const idlTypeTree = buildIdlNamespace(parsedInput)

  ; (function printIdlTypeTree (node) {
    if (typeof node === 'string') {
      console.log(node)
    } else if (Array.isArray(node)) {
      node.forEach((n) => printIdlTypeTree(n))
    } else {
      throw new Error(`Failed to process node [${node}]`)
    }
  })(idlTypeTree)
