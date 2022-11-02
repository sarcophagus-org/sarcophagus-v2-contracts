import { BigNumber, ContractTransaction } from "ethers";
import { deployments } from "hardhat";
import {
  AdminFacet,
  SignatoryFacet,
  VaultOwnerFacet,
  IERC20,
  ThirdPartyFacet,
  ViewStateFacet,
} from "../../typechain";
import time from "../utils/time";
import { spawnSignatoriesWithSignatures, TestSignatory } from "./spawn-signatories";

const sss = require("shamirs-secret-sharing");

/**
 * A fixture to set up a test that requires a successful creation on a
 * transferable vault. Deploys all contracts required for the system,
 * and creates a vault with given config and name, with signatories
 * created and pre-configured for it.
 *
 * Resurrection time is set to 1 week.
 * maxRewrapInterval defaults to 1 week.
 *
 * Optionally, creating may be skipped. It's also possible to
 * indicate to return a specified number of signatories not bonded to the
 * vault that is setup, and not await the createVault
 * transaction Promises.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const createVaultFixture = (
  config: {
    shares: number;
    threshold: number;
    skipCreateTx?: boolean;
    skipAwaitCreateTx?: boolean;
    addUnbondedSignatories?: number;
    arweaveTxIds?: string[];
    signatoryMinDiggingFee?: BigNumber;
  },
  vaultName = "test init",
  maxRewrapInterval: number = time.duration.weeks(4)
) =>
  deployments.createFixture(
    async ({ deployments, getNamedAccounts, getUnnamedAccounts, ethers }) => {
      // Deploy contracts
      await deployments.fixture();

      const namedAccounts = await getNamedAccounts();
      
      const deployer = await ethers.getSigner(namedAccounts.deployer);

      // Get the entities interacting with the contracts
      const unnamedAccounts = await getUnnamedAccounts();
      const vaultOwner = await ethers.getSigner(unnamedAccounts[0]);
      const recipient = await ethers.getSigner(unnamedAccounts[1]);
      const thirdParty = await ethers.getSigner(unnamedAccounts[2]);

      const diamond = await ethers.getContract("Diamond_DiamondProxy");
      const heritageToken = await ethers.getContract("HeritageTokenMock");
      const vaultOwnerFacet = (await ethers.getContractAt(
        "VaultOwnerFacet",
        diamond.address
      )) as VaultOwnerFacet;
      const signatoryFacet = await ethers.getContractAt("SignatoryFacet", diamond.address);
      const thirdPartyFacet = await ethers.getContractAt("ThirdPartyFacet", diamond.address);
      const viewStateFacet = await ethers.getContractAt("ViewStateFacet", diamond.address);
      const adminFacet = await ethers.getContractAt("AdminFacet", diamond.address);

      
      // Transfer 100,000 heritage tokens to the vaultOwner
      let txTransfer = await heritageToken.transfer(vaultOwner.address, ethers.utils.parseEther("100000"));
      
      // Approve the vaultOwner on the heritage token
      let txApprov = await heritageToken.connect(vaultOwner).approve(diamond.address, ethers.constants.MaxUint256);
      
      // Set up the data for the vault
      // 64-byte key:
      const outerLayerPrivateKey =
        "ce6cb1ae13d79a053daba0e960411eba8648b7f7e81c196fd6b36980ce3b3419";

      const secret = Buffer.from(outerLayerPrivateKey);
      const shards: Buffer[] = sss.split(secret, config);

      // TODO -- need to determine how vault name will be genned, b/c it needs to be unique
      // we could add a random salt to this
      const vaultId = ethers.utils.solidityKeccak256(["string"], [vaultName]);
      const arweaveTxIds = config.arweaveTxIds || ["FilePayloadTxId", "EncryptedShardTxId"];
      const timestamp = await time.latest();
      const [signatories, signatures] = await spawnSignatoriesWithSignatures(
        shards,
        arweaveTxIds[1] || "fakeArweaveTxId",
        signatoryFacet as SignatoryFacet,
        (heritageToken as IERC20).connect(deployer),
        diamond.address,
        maxRewrapInterval,
        timestamp,
        config.signatoryMinDiggingFee
      );

      const unbondedSignatories: TestSignatory[] = [];

      if (config.addUnbondedSignatories !== undefined) {
        // use indices from tail-end of unnamed accounts that have not been
        // taken by signatories initialization above
        // (in spawnSignatoriesWithSignatures).
        const startI = unnamedAccounts.length - signatories.length - 1;
        const endI = startI - config.addUnbondedSignatories;

        for (let i = startI; i > endI; i--) {
          const acc = await ethers.getSigner(unnamedAccounts[i]);

          unbondedSignatories.push({
            signatoryAddress: acc.address,
            unencryptedShardDoubleHash: "",
            unencryptedShard: [],
            signer: acc,
            diggingFee: ethers.utils.parseEther("10"),
            v: BigNumber.from(0),
            r: "",
            s: "",
          });

          // Transfer 10,000 heritage tokens to each signatory to be put into free
          // bond, and approve spending
          await (heritageToken as IERC20)
            .connect(deployer)
            .transfer(acc.address, ethers.utils.parseEther("10000"));

          await heritageToken.connect(acc).approve(diamond.address, ethers.constants.MaxUint256);

          await signatoryFacet
            .connect(acc)
            .registerSignatory(
              "myFakePeerId",
              ethers.utils.parseEther("10"),
              maxRewrapInterval,
              ethers.utils.parseEther("5000")
            );
        }
      }
      
      const resurrectionTime = (await time.latest()) + time.duration.weeks(1);

      const vaultOwnerBalanceBeforeCreate = await heritageToken.balanceOf(vaultOwner.address);
      console.log('Got here: ', heritageToken.address, ', vowFacet: ', vaultOwnerFacet.address, ', vOwn: ', vaultOwner.address, ', config: ', config )
      // Create a vault as the vaultOwner
      let createTx: Promise<ContractTransaction> | undefined;
      try{
      if (!config.skipCreateTx) {
        createTx = vaultOwnerFacet.connect(vaultOwner).createVault(
          vaultId,
          {
            name: vaultName,
            recipient: recipient.address,
            resurrectionTime,
            maximumRewrapInterval: maxRewrapInterval,
            canBeTransferred: true,
            minShards: config.threshold,
            timestamp,
          },
          signatories,
          arweaveTxIds
        );
      }

    }catch(err){
      console.error('Error crreating: ',err)
    }

      if (config.skipAwaitCreateTx !== true) {
        await createTx;
      }
    

      return {
        vaultId,
        deployer,
        vaultOwner,
        recipient,
        thirdParty,
        signatories,
        unbondedSignatories,
        signatures,
        arweaveTxIds,
        vaultOwnerBalanceBeforeCreate,
        shards,
        createTx,
        resurrectionTime,
        diamond,
        timestamp,
        maximumRewrapInterval: maxRewrapInterval,
        signatoryMinDiggingFee: config.signatoryMinDiggingFee,
        heritageToken: heritageToken as IERC20,
        vaultOwnerFacet: vaultOwnerFacet as VaultOwnerFacet,
        signatoryFacet: signatoryFacet as SignatoryFacet,
        thirdPartyFacet: thirdPartyFacet as ThirdPartyFacet,
        viewStateFacet: viewStateFacet as ViewStateFacet,
        adminFacet: adminFacet as AdminFacet,
      };
    }
  )();
