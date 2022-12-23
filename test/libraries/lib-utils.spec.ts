import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";

import { Contract } from "ethers";
import { hexDataSlice } from "ethers/lib/utils";
import { ethers } from "hardhat";
import { sign } from "../utils/helpers";

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
    const message = "Hello";

    beforeEach(async () => {
      signer = await ethers.getSigner(wallet.address);
    });

    it("should successfully verify a signature", async () => {
      const { v, r, s } = await sign(signer, [message], ["string"]);

      const messageHex = ethers.utils.defaultAbiCoder.encode(
        ["string"],
        [message]
      );

      const result = await libUtilsTest.verifySignature(
        messageHex,
        hexDataSlice(wallet.publicKey, 1),
        v,
        r,
        s
      );

      expect(result).to.be.true;
    });

    it("should return false if message is incorrect", async () => {
      const message = "Hello";

      const { v, r, s } = await sign(signer, [message], ["string"]);

      const messageHex = ethers.utils.defaultAbiCoder.encode(
        ["string"],
        ["incorrect message"]
      );

      const result = await libUtilsTest.verifySignature(
        messageHex,
        hexDataSlice(wallet.publicKey, 1),
        v,
        r,
        s
      );

      expect(result).to.be.false;
    });

    it("should return false if public key is incorrect", async () => {
      const message = "Hello";

      const { v, r, s } = await sign(signer, [message], ["string"]);

      const messageHex = ethers.utils.defaultAbiCoder.encode(
        ["string"],
        [message]
      );

      const result = await libUtilsTest.verifySignature(
        messageHex,
        "0x",
        v,
        r,
        s
      );

      expect(result).to.be.false;
    });
  });
});
