import "@nomicfoundation/hardhat-chai-matchers";

const { deployments, ethers } = require("hardhat");

describe("ThirdPartyFacet.clean", () => {
  // reset to directly after the diamond deployment before each test
  beforeEach(async () => await deployments.fixture());

  describe("Validates parameters. Should revert if:", function () {
    it("no sarcophagus with the supplied id exists");
    it("called by embalmer after the embalmerCleanWindow has passed");
    it(
      "called by admin before the embalmerCleanWindow has passed but after the resurrectionTime + gracePeriod have passed"
    );
    it("called by third party at any time");

    it("sarcophagus is compromised");
    it("sarcophagus is cleaned");
    it("sarcophagus is buried");
  });

  describe("Successfully cleans a sarcophagus  ", function () {
    it("does not transfer bonds or digging fees for accused archaeologists");
    it("emits a Clean event");
    it("sets isCleaned = true on the sarcophagus");
  });

  describe("Handles payout to the embalmer", function () {
    it(
      "transfers all locked bonds and digging fees for archaeologists that have failed to supply keyshares to the embalmer"
    );
    it(
      "does not transfer any funds to the embalmer if all archaeologists have supplied keyshares"
    );
  });

  describe("Handles payout to the admin", function () {
    it(
      "transfers all locked bonds and digging fees for archaeologists that have failed to supply keyshares to the protocol fees"
    );
    it(
      "does not transfer any funds to protocol fees if all archaeologists have supplied keyshares"
    );
  });
});
