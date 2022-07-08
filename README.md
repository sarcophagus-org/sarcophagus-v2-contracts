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
`npx hardhat run scripts/deploy-diamond.ts --network local`
Setup and/or add networks in the hardhat config file, `hardhat.config.ts`. You can then replace `local` with whichever network you'd like to deploy to.
