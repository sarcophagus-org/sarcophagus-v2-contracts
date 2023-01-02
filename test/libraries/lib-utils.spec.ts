import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

import { Contract } from "ethers";
import { ethers } from "hardhat";
import { sign } from "../utils/helpers";
import crypto from "crypto";

describe("LibUtils", () => {
  let libUtilsTest: Contract;

  beforeEach(async () => {
    const LibUtilsTest = await ethers.getContractFactory("LibUtilsTest");
    libUtilsTest = await LibUtilsTest.deploy();
  });

  describe("verifySignature()", () => {
    let signer: SignerWithAddress;
    const wallet = new ethers.Wallet(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    );
    const message = ethers.utils.solidityKeccak256(
      ["string"],
      ["sarcophagus id"]
    );

    beforeEach(async () => {
      signer = await ethers.getSigner(wallet.address);
    });

    it("should successfully verify a signature", async () => {
      const { v, r, s } = await sign(signer, [message], ["bytes"]);

      const messageHex = ethers.utils.defaultAbiCoder.encode(
        ["bytes"],
        [message]
      );

      const result = await libUtilsTest.verifySignature(
        messageHex,
        wallet.publicKey,
        v,
        r,
        s
      );

      expect(result).to.be.true;
    });

    it("should return false if message is incorrect", async () => {
      const message = ethers.utils.solidityKeccak256(
        ["string"],
        ["sarcophagus id"]
      );
      const { v, r, s } = await sign(signer, [message], ["bytes"]);

      const messageHex = ethers.utils.defaultAbiCoder.encode(
        ["bytes"],
        [ethers.utils.solidityKeccak256(["string"], ["incorrect id"])]
      );

      const result = await libUtilsTest.verifySignature(
        messageHex,
        wallet.publicKey,
        v,
        r,
        s
      );

      expect(result).to.be.false;
    });

    it("should return false if public key is incorrect", async () => {
      const message = ethers.utils.solidityKeccak256(
        ["string"],
        ["sarcophagus id"]
      );

      const { v, r, s } = await sign(signer, [message], ["bytes"]);

      const messageHex = ethers.utils.defaultAbiCoder.encode(
        ["bytes"],
        [message]
      );

      const result = await libUtilsTest.verifySignature(
        messageHex,
        new ethers.utils.SigningKey(
          "0x" + crypto.randomBytes(32).toString("hex")
        ).publicKey,
        v,
        r,
        s
      );

      expect(result).to.be.false;
    });
  });
});
