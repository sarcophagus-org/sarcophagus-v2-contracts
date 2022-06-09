import "@nomiclabs/hardhat-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { deployDiamond } from "../../scripts/deploy-diamond";
import { ArchaeologistFacet, SarcoTokenMock } from "../../typechain";
import { Archaeologist } from "../../types";
import { BigNumber, ContractTransaction } from "ethers";
import { EmbalmerFacet } from "../../typechain/EmbalmerFacet";

describe.only("Contract: ArchaeologistFacet", () => {
  let archaeologistFacet: ArchaeologistFacet;
  let archaeologist: SignerWithAddress;
  let sarcoToken: SarcoTokenMock;
  let archaeologistSarcBalance: BigNumber;
  let diamondAddress: string;

  const beforeEachFunc = async () => {
    // Get the signers
    const signers = await ethers.getSigners();

    // Set the archaeologist
    archaeologist = signers[0];

    // Deploy the Diamond contract
    diamondAddress = await deployDiamond();

    // Deploy the sarco token contract
    const SarcoToken = await ethers.getContractFactory("SarcoTokenMock");
    sarcoToken = await SarcoToken.deploy();
    await sarcoToken.deployed();

    // Approve the archaeologist on the sarco token
    await sarcoToken
      .connect(archaeologist)
      .approve(diamondAddress, ethers.constants.MaxUint256);

    // Get the ArchaeologistFacet contract
    archaeologistFacet = await ethers.getContractAt(
      "ArchaeologistFacet",
      diamondAddress
    );

    // Get the archaeologist's sarco token balance
    archaeologistSarcBalance = await sarcoToken.balanceOf(
      archaeologist.address
    );
  };

  describe("depositFreeBond()", () => {
    before(beforeEachFunc);

    it("should deposit free bond to the contract", async () => {
      // Deposit free bond
      const tx = await archaeologistFacet.depositFreeBond(
        archaeologist.address,
        BigNumber.from(100),
        sarcoToken.address
      );
      const receipt = await tx.wait();

      // Check that the transaction succeeded
      expect(receipt.status).to.equal(1);

      // Get the free bond of the archaeologist on the contract and check that
      // it is correct
      const freeBond = await archaeologistFacet.getFreeBond(
        archaeologist.address
      );
      expect(freeBond.toString()).to.equal("100");

      // Get the sarco token balance of the archaeologist and check that it is correct
      const sarcoTokenBalance = await sarcoToken.balanceOf(
        archaeologist.address
      );
      expect(sarcoTokenBalance.toString()).to.equal(
        archaeologistSarcBalance.sub(BigNumber.from(100)).toString()
      );

      // Get the sarco token balance of the contract and check that it is correct
      const contractSarcBalance = await sarcoToken.balanceOf(
        archaeologistFacet.address
      );
      expect(contractSarcBalance.toString()).to.equal("100");
    });

    it("should emit an event when the free bond is deposited", async () => {
      // Deposit free bond
      const tx = await archaeologistFacet.depositFreeBond(
        archaeologist.address,
        BigNumber.from(100),
        sarcoToken.address
      );
      const receipt = await tx.wait();
      const events = receipt.events!;
      expect(events).to.not.be.undefined;

      // Check that the list of events includes an event that has an address matching the archaeologistFacet address
      expect(
        events.some((event) => event.address === archaeologistFacet.address)
      ).to.be.true;
    });

    it("should emit a transfer event when the sarco token is transfered", async () => {
      // Deposit free bond
      const tx = await archaeologistFacet.depositFreeBond(
        archaeologist.address,
        BigNumber.from(100),
        sarcoToken.address
      );
      const receipt = await tx.wait();
      const events = receipt.events!;
      expect(events).to.not.be.undefined;

      // Check that the list of events includes an event that has an address matching the archaeologistFacet address
      expect(events.some((event) => event.address === sarcoToken.address)).to.be
        .true;
    });

    it("should revert if amount is negative", async () => {
      // Try to deposit a negative amount
      await expect(
        archaeologistFacet.depositFreeBond(
          archaeologist.address,
          BigNumber.from(-1),
          sarcoToken.address
        )
      ).to.be.reverted;
    });

    it("should revert if sender is not the archaeologist", async () => {
      // Try to deposit with a non-archaeologist address
      await expect(
        archaeologistFacet.depositFreeBond(
          ethers.constants.AddressZero,
          BigNumber.from(1),
          sarcoToken.address
        )
      ).to.be.revertedWith("sender must be the archaeologist");
    });
  });

  describe("withdrawFreeBond()", () => {
    before(beforeEachFunc);

    it("should withdraw free bond from the contract", async () => {
      // Deposit free bond
      await archaeologistFacet.depositFreeBond(
        archaeologist.address,
        BigNumber.from(100),
        sarcoToken.address
      );

      // Withdraw free bond
      const tx = await archaeologistFacet.withdrawFreeBond(
        archaeologist.address,
        BigNumber.from(100),
        sarcoToken.address
      );
      const receipt = await tx.wait();

      // Check that the transaction succeeded
      expect(receipt.status).to.equal(1);

      // Get the free bond of the archaeologist on the contract and check that
      // it is correct
      const freeBond = await archaeologistFacet.getFreeBond(
        archaeologist.address
      );
      expect(freeBond.toString()).to.equal("0");

      // Get the sarco token balance of the archaeologist and check that it is correct
      const sarcoTokenBalance = await sarcoToken.balanceOf(
        archaeologist.address
      );
      expect(sarcoTokenBalance.toString()).to.equal(
        archaeologistSarcBalance.toString()
      );

      // Get the sarco token balance of the contract and check that it is correct
      const contractSarcBalance = await sarcoToken.balanceOf(
        archaeologistFacet.address
      );
      expect(contractSarcBalance.toString()).to.equal("0");
    });

    it("should emit an event when the free bond is withdrawn", async () => {
      // Deposit free bond
      await archaeologistFacet.depositFreeBond(
        archaeologist.address,
        BigNumber.from(100),
        sarcoToken.address
      );

      // Withdraw free bond
      const tx = await archaeologistFacet.withdrawFreeBond(
        archaeologist.address,
        BigNumber.from(100),
        sarcoToken.address
      );
      const receipt = await tx.wait();
      const events = receipt.events!;
      expect(events).to.not.be.undefined;

      // Check that the list of events includes an event that has an address matching the archaeologistFacet address
      expect(
        events.some((event) => event.address === archaeologistFacet.address)
      ).to.be.true;
    });

    it("should emit a transfer event when the sarco token is transfered", async () => {
      // Deposit free bond
      await archaeologistFacet.depositFreeBond(
        archaeologist.address,
        BigNumber.from(100),
        sarcoToken.address
      );

      // Withdraw free bond
      const tx = await archaeologistFacet.withdrawFreeBond(
        archaeologist.address,
        BigNumber.from(100),
        sarcoToken.address
      );
      const receipt = await tx.wait();
      const events = receipt.events!;
      expect(events).to.not.be.undefined;

      // Check that the list of events includes an event that has an address matching the archaeologistFacet address
      expect(events.some((event) => event.address === sarcoToken.address)).to.be
        .true;
    });

    it("should revert if amount is negative", async () => {
      // Try to withdraw a negative amount
      await expect(
        archaeologistFacet.withdrawFreeBond(
          archaeologist.address,
          BigNumber.from(-1),
          sarcoToken.address
        )
      ).to.be.reverted;
    });

    it("should revert if sender is not the archaeologist", async () => {
      // Try to withdraw with a non-archaeologist address
      await expect(
        archaeologistFacet.withdrawFreeBond(
          ethers.constants.AddressZero,
          BigNumber.from(1),
          sarcoToken.address
        )
      ).to.be.revertedWith("sender must be the archaeologist");
    });
  });
});
