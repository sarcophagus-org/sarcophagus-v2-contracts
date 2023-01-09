import { expect } from "chai";

import { Contract } from "ethers";
import { sign } from "../../utils/helpers";
import crypto from "crypto";
import { ethers } from "hardhat";

describe("LibUtils.verifyAccusalSignature()", function () {
  const sarcoId = ethers.utils.solidityKeccak256(
    ["string"],
    ["sarcophagus id"]
  );

  let libUtilsTest: Contract;
  beforeEach(async function () {
    const LibUtilsTest = await ethers.getContractFactory("LibUtilsTest");
    libUtilsTest = await LibUtilsTest.deploy();
  });

  it("should pass a signature created with the supplied sarcoId, payment address, and signing public key", async function () {
    const signer = new ethers.Wallet(
      "0x" + crypto.randomBytes(32).toString("hex")
    );
    const paymentAddress = new ethers.Wallet(
      "0x" + crypto.randomBytes(32).toString("hex")
    ).address;

    const signature = await sign(
      signer,
      [sarcoId, paymentAddress],
      ["bytes32", "address"]
    );

    const result = await libUtilsTest.verifySignature(
      sarcoId,
      paymentAddress,
      signer.publicKey,
      { v: signature.v, r: signature.r, s: signature.s }
    );
    expect(result).to.be.true;
  });

  it("should fail a signature created with the wrong sarcoId", async () => {
    const signer = new ethers.Wallet(
      "0x" + crypto.randomBytes(32).toString("hex")
    );
    const paymentAddress = new ethers.Wallet(
      "0x" + crypto.randomBytes(32).toString("hex")
    ).address;
    const signature = await sign(
      signer,
      [sarcoId, paymentAddress],
      ["bytes32", "address"]
    );

    const result = await libUtilsTest.verifySignature(
      ethers.utils.solidityKeccak256(["string"], ["incorrect sarcophagus id"]),
      paymentAddress,
      signer.publicKey,
      { v: signature.v, r: signature.r, s: signature.s }
    );
    expect(result).to.be.false;
  });

  it("should fail a signature created with the wrong payment address", async function () {
    const signer = new ethers.Wallet(
      "0x" + crypto.randomBytes(32).toString("hex")
    );
    const paymentAddress = new ethers.Wallet(
      "0x" + crypto.randomBytes(32).toString("hex")
    ).address;
    const signature = await sign(
      signer,
      [sarcoId, paymentAddress],
      ["bytes32", "address"]
    );

    const result = await libUtilsTest.verifySignature(
      sarcoId,
      new ethers.Wallet("0x" + crypto.randomBytes(32).toString("hex")).address,
      signer.publicKey,
      { v: signature.v, r: signature.r, s: signature.s }
    );
    expect(result).to.be.false;
  });
  it("should fail a signature created with the incorrect key", async function () {
    const signer = new ethers.Wallet(
      "0x" + crypto.randomBytes(32).toString("hex")
    );
    const paymentAddress = new ethers.Wallet(
      "0x" + crypto.randomBytes(32).toString("hex")
    ).address;

    const signature = await sign(
      signer,
      [sarcoId, paymentAddress],
      ["bytes32", "address"]
    );

    const result = await libUtilsTest.verifySignature(
      sarcoId,
      paymentAddress,
      new ethers.Wallet("0x" + crypto.randomBytes(32).toString("hex"))
        .publicKey,
      { v: signature.v, r: signature.r, s: signature.s }
    );
    expect(result).to.be.false;
  });
});
