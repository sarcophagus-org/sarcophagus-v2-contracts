import { Signature } from "ethers";
import { deployments } from "hardhat";
import { FixtureArchaeologist, SignatureWithAccount } from "../../types";
import { sign } from "../utils/helpers";
import { initializeSarcophagus } from "./initialize-sarcophagus";
import { setupArchaeologists } from "./setup-archaeologists";

export const setupArweaveArchSig = deployments.createFixture(
  async ({
    deployments,
    getNamedAccounts,
    getUnnamedAccounts,
    ethers,
  }): Promise<{
    arweaveTxId: string;
    signatureWithAccount: SignatureWithAccount;
  }> => {
    const arweaveTxId = "arweaveTxId";
    const archaeologists = await setupArchaeologists();
    const arweaveArchaeologist = archaeologists[0];

    const signature = await sign(
      arweaveArchaeologist.signer,
      arweaveTxId,
      "bytes"
    );

    const signatureWithAccount = Object.assign(signature, {
      account: arweaveArchaeologist.account,
    });

    return {
      arweaveTxId,
      signatureWithAccount,
    };
  }
);
