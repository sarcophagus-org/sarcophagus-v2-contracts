import { ContractTransaction } from "ethers";
import { deployments } from "hardhat";
import {
  ArchaeologistFacet,
  EmbalmerFacet,
  IERC20,
  ThirdPartyFacet,
} from "../../typechain";
import { sign } from "../utils/helpers";
import time from "../utils/time";
import { spawnArchaologistsWithSignatures } from "./spawn-archaeologists";

const sss = require("shamirs-secret-sharing");

/**
 * A fixture to set up a test that reqiures a successful initialization on a
 * sarcophagus. Deploys all contracts required for the system, and initializes
 * a sarcophagus with given config and name, with archaeologists created and
 * pre-configured for it.
 *
 * Arweave archaeologist is set to the first in the returned list of archaeologists.
 */
export const initializeSarcoFixture = (
  config: {
    shares: number;
    threshold: number;
  },
  sarcoName: string
) =>
  deployments.createFixture(
    async ({ deployments, getNamedAccounts, getUnnamedAccounts, ethers }) => {
      // Deploy contracts
      await deployments.fixture();

      // Get the entities interacting with the contracts
      const unnamedAccounts = await getUnnamedAccounts();
      const embalmer = await ethers.getSigner(unnamedAccounts[0]);
      const recipient = await ethers.getSigner(unnamedAccounts[1]);

      const diamond = await ethers.getContract("Diamond_DiamondProxy");
      const sarcoToken = await ethers.getContract("SarcoTokenMock");
      const embalmerFacet = await ethers.getContractAt(
        "EmbalmerFacet",
        diamond.address
      );
      const archaeologistFacet = await ethers.getContractAt(
        "ArchaeologistFacet",
        diamond.address
      );
      const thirdPartyFacet = await ethers.getContractAt(
        "ThirdPartyFacet",
        diamond.address
      );

      // Transfer 100,000 sarco tokens to each embalmer
      await sarcoToken.transfer(
        embalmer.address,
        ethers.utils.parseEther("100000")
      );

      // Approve the embalmer on the sarco token
      await sarcoToken
        .connect(embalmer)
        .approve(diamond.address, ethers.constants.MaxUint256);

      // Set up the data for the sarcophagus
      // const publicKey =
      //   "-----BEGIN PUBLIC KEY-----\nMFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBANFcUwtJSlCR65MqRqRmbJjBSuAhyxmN\nXmEV0imtcsKRiBHhHIxAAN/bw1tfzpHvAoM47iR11S7XsEfMjyW/nokCAwEAAQ==\n----- END PUBLIC KEY-----";
      const privateKey =
        "-----BEGIN PRIVATE KEY-----\nMIIBVQIBADANBgkqhkiG9w0BAQEFAASCAT8wggE7AgEAAkEA0VxTC0lKUJHrkypG\npGZsmMFK4CHLGY1eYRXSKa1ywpGIEeEcjEAA39vDW1/Oke8CgzjuJHXVLtewR8yP\nJb+eiQIDAQABAkEApXBbfzOvMfPdQDHMGOWHMz6rOGn74HlB914S8TRK10xTG0wG\n/4Y6pUJbRRqOanxkLgCBBZS9OvTF+dRf/VTVwQIhAPDB1OR8mXPgkoEsfJyBk5dw\n5uLnyN/jJyeaogSXILxFAiEA3p2fBYYVlbMnzNVi3yaglyxRiN0k2Oc7tfusPhtH\n93UCIQDQCj5jvkN/vUP7uSxotROLXnU1B6MtzATOlTGBk/ImnQIgZNquH7eGceLP\npjoKaCS83qBCdCoUNnxUDfduKlj7ur0CIBU7jkKqIw83yTJsLxWSiu9n07LbWss6\nGXukOtNeIAeZ\n-----END PRIVATE KEY-----";

      const secret = Buffer.from(privateKey);
      const shards: Buffer[] = sss.split(secret, config);

      const sarcoId = ethers.utils.solidityKeccak256(["string"], [sarcoName]);
      const namedAccounts = await getNamedAccounts();
      const deployer = await ethers.getSigner(namedAccounts.deployer);

      const [archaeologists, signatures] =
        await spawnArchaologistsWithSignatures(
          shards,
          sarcoId,
          archaeologistFacet as ArchaeologistFacet,
          (sarcoToken as IERC20).connect(deployer),
          diamond.address
        );

      const arweaveArchaeologist = archaeologists[0];
      const canBeTransferred = true;
      const resurrectionTime = (await time.latest()) + time.duration.weeks(1);

      const embalmerBalance = await sarcoToken.balanceOf(embalmer.address);

      // Create a sarcophagus as the embalmer
      const tx: ContractTransaction = await embalmerFacet
        .connect(embalmer)
        .initializeSarcophagus(
          sarcoName,
          sarcoId,
          archaeologists,
          arweaveArchaeologist.signer.address,
          recipient.address,
          resurrectionTime,
          canBeTransferred,
          config.threshold
        );

      const arweaveTxId = "arweaveTxId";

      const arweaveSignature = await sign(
        arweaveArchaeologist.signer,
        arweaveTxId,
        "string"
      );

      return {
        sarcoId,
        tx,
        sarcoToken: sarcoToken as IERC20,
        embalmer,
        archaeologists,
        signatures,
        arweaveSignature,
        arweaveArchaeologist,
        arweaveTxId,
        embalmerBalance,
        embalmerFacet: embalmerFacet as EmbalmerFacet,
        shards,
        archaeologistFacet: archaeologistFacet as ArchaeologistFacet,
        thirdPartyFacet: thirdPartyFacet as ThirdPartyFacet,
      };
    }
  )();
