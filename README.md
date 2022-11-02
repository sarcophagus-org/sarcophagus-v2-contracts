# Heritage Core V2

[![Discord](https://img.shields.io/discord/753398645507883099?color=768AD4&label=discord)](https://discord.com/channels/753398645507883099/)
[![Twitter](https://img.shields.io/twitter/follow/Heritageio?style=social)](https://twitter.com/Heritageio)

Heritage is a decentralized Dead Man's Switch built for EVM and Arweave.

## Overview

This repository contains the smart contracts (and corresponding deployment scripts) that power the Heritage system. 

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
npm i heritage-contracts
```

## Updating
Update the `version` at the top of package.json. Increment the third number (PATCH version) for bugfixes, the second number (MINOR version) for backwards compatible functionality additions, and the first number (MAJOR version) for breaking API changes. 
```shell
npm i
npm run prepublish
npm publish
```
Commit updated version to git




## Terms
### Vault
The Encrypted instance holding the file to be encrypted or the assets to be distributed when the VaultOwner no longer attests to it.

### Vault Owner
The Creator of a vault. They choose the content of a vault and decide how long it should be encrypted for. They determine the reward to be paid to the Signatories

### Signatory
Signatories are third-party utility providers. Their goal is to make more money in rewards and
utility fees than it costs them to operate their infrastructure.
They operate servers and post their own capital as bonds. If a Vault Opening time has elapsed (i.e., the Vault Owner fails an attestation) the Signatory will spend their own funds to affect the unwrapping of the outer layer of the vault 

### Recipient
The Recipient is/are the Public Addresses of the users who can get access to the Assets/Payload stored in a vault