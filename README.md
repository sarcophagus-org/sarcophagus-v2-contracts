# Sarcophagus Core V2

[![Discord](https://img.shields.io/discord/753398645507883099?color=768AD4&label=discord)](https://discord.com/channels/753398645507883099/)
[![Twitter](https://img.shields.io/twitter/follow/sarcophagusio?style=social)](https://twitter.com/sarcophagusio)

Sarcophagus is a decentralized Dead Man's Switch built on Ethereum and Arweave.

## Overview

This repository contains the smart contracts (and corresponding deployment scripts) that power version 2 of the Sarcophagus system. Version 1 of Sarcophagus can be found here [Sarcophgus V1](https://github.com/sarcophagus-org/sarcophagus-contracts).

## Quick Start

- Pull the repo
- Copy the contents of .env.example into .env. Edit as needed.
- Install [nvm](https://github.com/nvm-sh/nvm) if needed
  In project root, run
- `nvm use`
- `npm install`
- `npx hardhat compile`

### Running tests

`npx hardhat test`

### Running a local node instance

`npx hardhat node`

### Deploying

`npx hardhat deploy --network <networkName>`
Setup and/or add networks in the hardhat config file, `hardhat.config.ts`. 
You can then replace `<networkName>` with whichever network you'd like to deploy to (`localhost` for the local network spun up by `npx hardhat node`).
Omitting the `--network` flag causes the command to run on the default network, usually the default in-memory and ephemeral `hardhat` network.

### Upgrading Contracts

## When testing with `npx hardhat test`
Contracts are recompiled and redeployed every time tests are run this way, so the most recently saved contract code is always run.
This is still the case even if `--network` is specified.

## Deployed contracts
To upgrade contracts that have already been deployed, simply run `npx hardhat deploy --network <networkName>` again.
This does not re-deploy all facets - only those that have code changes.

## Simulating an upgrade locally
- Have a local node running `npx hardhat node`
- Deploy the contracts `npx hardhat deploy --network localhost`
- In `scripts/run.ts`, uncomment the `createSarcoScript` line
- Run `npx hardhat run scripts/run.ts`. A sarchophagus would have been created on the locally running network.
- Comment out the `createSarcoScript` line if needed.
- Edit contract code, modify `run.ts` as needed to confirm changes have NOT been reflected.
- Run `npx hardhat deploy --network localhost`. This will redeploy updated contract facets.
- Modify `run.ts` as needed to confirm changes have now been reflected. Verify the diamond contract address remains same.
