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


# NPM Package
The core contracts in this repository are published in an NPM package for easy use within other repositories.

To install the npm package, run:
 ```shell
npm i @sarcophagus-org/sarcophagus-v2-contracts
```

## Updating
Update the `version` at the top of package.json. Increment the third number (PATCH version) for bugfixes, the second number (MINOR version) for backwards compatible functionality additions, and the first number (MAJOR version) for breaking API changes. 
```shell
npm i
npm run prepublish
npm publish
```
Commit updated version to git
