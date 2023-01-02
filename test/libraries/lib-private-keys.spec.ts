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

      const tx = libPrivateKeysTest
        .connect(owner)
        .keyVerification(
          wallet.privateKey,
          ethers.utils.computePublicKey(wallet.privateKey)
        );

      await expect(tx).to.emit(libPrivateKeysTest, `True`);
    });

    it("should return false if the private and public keys do not match", async () => {
      const [owner] = await ethers.getSigners();

      const wallet1 = ethers.utils.HDNode.fromMnemonic(
        "sport prize void success viable play party catalog mimic april engage knock dial glad reflect"
      );

      const wallet2 = ethers.utils.HDNode.fromMnemonic(
        "submit tissue swap slow omit hospital blame perfect equal caught switch amazing"
      );

      const tx = libPrivateKeysTest
        .connect(owner)
        .keyVerification(
          wallet1.privateKey,
          ethers.utils.computePublicKey(wallet2.privateKey)
        );

      await expect(tx).to.emit(libPrivateKeysTest, `False`);
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
        const txs = [];

        for (let i = 0; i < mnemonics.length; i++) {
          const wallet = ethers.utils.HDNode.fromMnemonic(mnemonics[i]);

          const tx = libPrivateKeysTest.connect(owner).keyVerification(
            wallet.privateKey,

            ethers.utils.computePublicKey(wallet.privateKey)
          );

          txs.push(tx);
        }
        await Promise.all(
          txs.map(async (tx) => {
            await expect(tx).to.emit(libPrivateKeysTest, `True`);
          })
        );
      });
    });
  });
});
