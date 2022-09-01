import { BigNumber, ContractTransaction } from "ethers";
import { deployments, ethers } from "hardhat";
import {
  ArchaeologistFacet,
  CursesMock,
  EmbalmerFacet,
  IERC20,
  ThirdPartyFacet,
  ViewStateFacet,
} from "../../typechain";
import { sign } from "../utils/helpers";
import time from "../utils/time";
import { spawnArchaologistsWithSignatures, TestArchaeologist } from "./spawn-archaeologists";

const sss = require("shamirs-secret-sharing");

/**
 * A fixture to set up a test that requires a successful initialization on a
 * transferable sarcophagus. Deploys all contracts required for the system,
 * and initializes a sarcophagus with given config and name, with archaeologists
 * created and pre-configured for it.
 *
 * Resurrection time is set to 1 week.
 * maxResurrectionInterval defaults to 1 week.
 *
 * Optionally, initialising and finalising may be skipped. It's also possible to
 * indicate to return a specified number of archaeologists not bonded to the
 * sarcophagus that is setup, and not await the initialise and/or finalise
 * transaction Promises.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const createSarcoFixture = (
  config: {
    shares: number;
    threshold: number;
    skipInitialize?: boolean;
    skipFinalize?: boolean;
    dontAwaitInitTx?: boolean;
    dontAwaitFinalizeTx?: boolean;
    addUnbondedArchs?: number;
  },
  sarcoName: string,
  maxResurrectionInterval?: number
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
      const curses = await ethers.getContract("CursesMock");
      const embalmerFacet = (await ethers.getContractAt(
        "EmbalmerFacet",
        diamond.address
      )) as EmbalmerFacet;
      const archaeologistFacet = await ethers.getContractAt("ArchaeologistFacet", diamond.address);
      const thirdPartyFacet = await ethers.getContractAt("ThirdPartyFacet", diamond.address);
      const viewStateFacet = await ethers.getContractAt("ViewStateFacet", diamond.address);

      // Transfer 100,000 sarco tokens to each embalmer
      await sarcoToken.transfer(embalmer.address, ethers.utils.parseEther("100000"));

      // Approve the embalmer on the sarco token
      await sarcoToken.connect(embalmer).approve(diamond.address, ethers.constants.MaxUint256);

      // Approve the diamond contract on the 1155 curses token
      await curses.connect(deployer).setApprovalForAll(diamond.address, true);

      // Set up the data for the sarcophagus
      // 64-byte key:
      const privateKey = "ce6cb1ae13d79a053daba0e960411eba8648b7f7e81c196fd6b36980ce3b3419";

      const secret = Buffer.from(privateKey);
      const shards: Buffer[] = sss.split(secret, config);

      const sarcoId = ethers.utils.solidityKeccak256(["string"], [sarcoName]);

      const [archaeologists, signatures] = await spawnArchaologistsWithSignatures(
        shards,
        sarcoId,
        archaeologistFacet as ArchaeologistFacet,
        (sarcoToken as IERC20).connect(deployer),
        diamond.address
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
            hashedShard: "",
            unencryptedShard: [],
            signer: acc,
            diggingFee: ethers.utils.parseEther("10")
          });

          // Transfer 10,000 sarco tokens to each archaeologist to be put into free
          // bond, and approve spending
          await (sarcoToken as IERC20)
            .connect(deployer)
            .transfer(acc.address, ethers.utils.parseEther("10000"));

          await sarcoToken.connect(acc).approve(diamond.address, ethers.constants.MaxUint256);

          await archaeologistFacet.connect(acc).registerArchaeologist(
            ethers.utils.parseEther("10"),
            BigNumber.from("1000"),
            ethers.utils.parseEther("5000")
          );
        }
      }

      const canBeTransferred = true;

      const resurrectionTime = (await time.latest()) + time.duration.weeks(1);

      const embalmerBalanceBefore = await sarcoToken.balanceOf(embalmer.address);

      // Create a sarcophagus as the embalmer
      let initializeTx: Promise<ContractTransaction> | undefined;
      if (config.skipInitialize !== true) {
        initializeTx = embalmerFacet.connect(embalmer).initializeSarcophagus(
          sarcoId,
          {
            name: sarcoName,
            recipient: recipient.address,
            resurrectionTime,
            canBeTransferred,
            minShards: config.threshold,
          },
          archaeologists,
        );
      }

      if (config.dontAwaitInitTx !== true) {
        await initializeTx;
      }

      const arweaveTxId = "arweaveTxId";

      // Finalize the sarcophagus (will be skipped if initialize is skipped)
      let finalizeTx: Promise<ContractTransaction> | undefined;
      if (config.skipInitialize !== true && config.skipFinalize !== true) {
        finalizeTx = embalmerFacet
          .connect(embalmer)
          .finalizeSarcophagus(sarcoId, signatures, arweaveTxId);
      }

      if (config.dontAwaitInitTx !== true && config.dontAwaitFinalizeTx !== true) {
        await finalizeTx;
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
        arweaveTxId,
        embalmerBalanceBefore,
        shards,
        initializeTx,
        finalizeTx,
        resurrectionTime,
        diamond,
        sarcoToken: sarcoToken as IERC20,
        curses: curses as CursesMock,
        embalmerFacet: embalmerFacet as EmbalmerFacet,
        archaeologistFacet: archaeologistFacet as ArchaeologistFacet,
        thirdPartyFacet: thirdPartyFacet as ThirdPartyFacet,
        viewStateFacet: viewStateFacet as ViewStateFacet,
      };
    }
  )();
