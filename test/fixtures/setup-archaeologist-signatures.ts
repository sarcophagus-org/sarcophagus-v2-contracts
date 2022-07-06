import { Signature } from "ethers";
import { deployments } from "hardhat";
import { FixtureArchaeologist, SignatureWithAccount } from "../../types";
import { sign } from "../utils/helpers";
import { initializeSarcophagus } from "./initialize-sarcophagus";
import { setupArchaeologists } from "./setup-archaeologists";

export const setupArchaeologistSignatures = deployments.createFixture(
  async ({
    deployments,
    getNamedAccounts,
    getUnnamedAccounts,
    ethers,
  }): Promise<SignatureWithAccount[]> => {
    const archaeologists = await setupArchaeologists();
    const identifier = await initializeSarcophagus();

    const signatures: SignatureWithAccount[] = [];

    for (const archaeologist of archaeologists) {
      // Sign a message and add to signatures. Only sign if the archaeologist
      // is not the arweave archaeologist
      const signature = await sign(archaeologist.signer, identifier, "bytes32");

      signatures.push(
        Object.assign(signature, { account: archaeologist.account })
      );
    }

    return signatures;
  }
);
