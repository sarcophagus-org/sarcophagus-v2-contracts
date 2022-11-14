import { BigNumber, ContractTransaction } from "ethers";
import { deployments } from "hardhat";
import {
  AdminFacet,
  ArchaeologistFacet,
  EmbalmerFacet,
  IERC20,
  ThirdPartyFacet,
  ViewStateFacet,
} from "../../typechain";
import time from "../utils/time";
import { spawnArchaologistsWithSignatures, TestArchaeologist } from "./spawn-archaeologists";

const sss = require("shamirs-secret-sharing");

/**
 * A fixture to set up a test that requires a successful creation on a
 * transferable sarcophagus. Deploys all contracts required for the system,
 * and creates a sarcophagus with given config and name, with archaeologists
 * created and pre-configured for it.
 *
 * Resurrection time is set to 1 week.
 * maxRewrapInterval defaults to 1 week.
 *
 * Optionally, creating may be skipped. It's also possible to
 * indicate to return a specified number of archaeologists not bonded to the
 * sarcophagus that is setup, and not await the createSarcophagus
 * transaction Promises.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const createSarcoFixture = (
  config: {
    shares: number;
    threshold: number;
    skipCreateTx?: boolean;
    skipAwaitCreateTx?: boolean;
    addUnbondedArchs?: number;
    arweaveTxIds?: string[];
    archMinDiggingFee?: BigNumber;
  },
  sarcoName = "test init",
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
      const embalmer = await ethers.getSigner(unnamedAccounts[0]);
      const recipient = await ethers.getSigner(unnamedAccounts[1]);
      const thirdParty = await ethers.getSigner(unnamedAccounts[2]);

      const diamond = await ethers.getContract("Diamond_DiamondProxy");
      const sarcoToken = await ethers.getContract("SarcoTokenMock");
      const embalmerFacet = (await ethers.getContractAt(
        "EmbalmerFacet",
        diamond.address
      )) as EmbalmerFacet;
      const archaeologistFacet = await ethers.getContractAt("ArchaeologistFacet", diamond.address);
      const thirdPartyFacet = await ethers.getContractAt("ThirdPartyFacet", diamond.address);
      const viewStateFacet = await ethers.getContractAt("ViewStateFacet", diamond.address);
      const adminFacet = await ethers.getContractAt("AdminFacet", diamond.address);

      // Transfer 100,000 sarco tokens to the embalmer
      await sarcoToken.transfer(embalmer.address, ethers.utils.parseEther("100000"));

      // Approve the embalmer on the sarco token
      await sarcoToken.connect(embalmer).approve(diamond.address, ethers.constants.MaxUint256);

      // Set up the data for the sarcophagus
      // 64-byte key:
      const outerLayerPrivateKey =
        "ce6cb1ae13d79a053daba0e960411eba8648b7f7e81c196fd6b36980ce3b3419";

      const secret = Buffer.from(outerLayerPrivateKey);
      const shards: Buffer[] = sss.split(secret, config);

      // TODO -- need to determine how sarco name will be genned, b/c it needs to be unique
      // we could add a random salt to this
      const sarcoId = ethers.utils.solidityKeccak256(["string"], [sarcoName]);
      const arweaveTxIds = config.arweaveTxIds || ["FilePayloadTxId", "EncryptedShardTxId"];
      const timestamp = await time.latest();
      const [archaeologists, signatures] = await spawnArchaologistsWithSignatures(
        shards,
        arweaveTxIds[1] || "fakeArweaveTxId",
        archaeologistFacet as ArchaeologistFacet,
        (sarcoToken as IERC20).connect(deployer),
        diamond.address,
        maxRewrapInterval,
        timestamp,
        config.archMinDiggingFee
      );

      const unbondedArchaeologists: TestArchaeologist[] = [];

      if (config.addUnbondedArchs !== undefined) {
        // use indices from tail-end of unnamed accounts that have not been
        // taken by archaeologists initialization above
        // (in spawnArchaologistsWithSignatures).
        const startI = unnamedAccounts.length - archaeologists.length - 1;
        const endI = startI - config.addUnbondedArchs;

        for (let i = startI; i > endI; i--) {
          const acc = await ethers.getSigner(unnamedAccounts[i]);

          unbondedArchaeologists.push({
            archAddress: acc.address,
            unencryptedShardDoubleHash: "",
            unencryptedShard: [],
            signer: acc,
            diggingFee: ethers.utils.parseEther("10"),
            v: BigNumber.from(0),
            r: "",
            s: "",
          });

          // Transfer 10,000 sarco tokens to each archaeologist to be put into free
          // bond, and approve spending
          await (sarcoToken as IERC20)
            .connect(deployer)
            .transfer(acc.address, ethers.utils.parseEther("10000"));

          await sarcoToken.connect(acc).approve(diamond.address, ethers.constants.MaxUint256);

          await archaeologistFacet
            .connect(acc)
            .registerArchaeologist(
              "myFakePeerId",
              ethers.utils.parseEther("10"),
              maxRewrapInterval,
              ethers.utils.parseEther("5000")
            );
        }
      }

      const resurrectionTime = (await time.latest()) + time.duration.weeks(1);

      const embalmerBalanceBeforeCreate = await sarcoToken.balanceOf(embalmer.address);

      // Create a sarcophagus as the embalmer
      let createTx: Promise<ContractTransaction> | undefined;
      if (!config.skipCreateTx) {
        createTx = embalmerFacet.connect(embalmer).createSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime,
            maximumRewrapInterval: maxRewrapInterval,
            minShards: config.threshold,
            timestamp,
          },
          archaeologists,
          arweaveTxIds
        );
      }

      if (config.skipAwaitCreateTx !== true) {
        await createTx;
      }

      return {
        sarcoId,
        deployer,
        embalmer,
        recipient,
        thirdParty,
        archaeologists,
        unbondedArchaeologists,
        signatures,
        arweaveTxIds,
        embalmerBalanceBeforeCreate,
        shards,
        createTx,
        resurrectionTime,
        diamond,
        timestamp,
        maximumRewrapInterval: maxRewrapInterval,
        archMinDiggingFee: config.archMinDiggingFee,
        sarcoToken: sarcoToken as IERC20,
        embalmerFacet: embalmerFacet as EmbalmerFacet,
        archaeologistFacet: archaeologistFacet as ArchaeologistFacet,
        thirdPartyFacet: thirdPartyFacet as ThirdPartyFacet,
        viewStateFacet: viewStateFacet as ViewStateFacet,
        adminFacet: adminFacet as AdminFacet,
      };
    }
  )();
