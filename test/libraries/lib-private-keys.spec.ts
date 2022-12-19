import "@nomicfoundation/hardhat-chai-matchers";
import { expect } from "chai";
import { Contract } from "ethers";
import { ethers } from "hardhat";
import fs from "fs";

describe("LibPrivateKeys", () => {
  let libPrivateKeysTest: Contract;

  beforeEach(async () => {
    const LibPrivateKeysTest = await ethers.getContractFactory(
      "LibPrivateKeysTest"
    );
    libPrivateKeysTest = await LibPrivateKeysTest.deploy();
  });

  describe("keyVerification", () => {
    it("should return true if the private and public keys match", async () => {
      const [owner] = await ethers.getSigners();

      const wallet = ethers.utils.HDNode.fromMnemonic(
        "sport prize void success viable play party catalog mimic april engage knock dial glad reflect"
      );

      const result = await libPrivateKeysTest
        .connect(owner)
        .keyVerification(
          wallet.privateKey,
          "0x" + ethers.utils.computePublicKey(wallet.privateKey).substring(4)
        );

      expect(result).to.be.true;
    });

    it("should return false if the private and public keys do not match", async () => {
      const [owner] = await ethers.getSigners();

      const wallet1 = ethers.utils.HDNode.fromMnemonic(
        "sport prize void success viable play party catalog mimic april engage knock dial glad reflect"
      );

      const wallet2 = ethers.utils.HDNode.fromMnemonic(
        "submit tissue swap slow omit hospital blame perfect equal caught switch amazing"
      );

      const result = await libPrivateKeysTest
        .connect(owner)
        .keyVerification(
          wallet1.privateKey,
          "0x" + ethers.utils.computePublicKey(wallet2.privateKey).substring(4)
        );

      expect(result).to.be.false;
    });

    context("with 100 wallets", () => {
      let mnemonics: string[];

      before(async () => {
        const mnemonicsJson = fs.readFileSync(
          "./test/libraries/mnemonics.json",
          "utf8"
        );
        mnemonics = JSON.parse(mnemonicsJson);
      });

      // This test makes 100 transactions on the block chain but should only take about 1 second
      it("should return true if the private and public keys match", async () => {
        const [owner] = await ethers.getSigners();
        const results: boolean[] = [];

        for (let i = 0; i < mnemonics.length; i++) {
          const wallet = ethers.utils.HDNode.fromMnemonic(mnemonics[i]);

          const result = await libPrivateKeysTest
            .connect(owner)
            .keyVerification(
              wallet.privateKey,
              "0x" +
                ethers.utils.computePublicKey(wallet.privateKey).substring(4)
            );

          results.push(result);
        }

        expect(results.every((result) => result)).to.be.true;
      });
    });
  });
});
