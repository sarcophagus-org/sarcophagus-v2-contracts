import "@nomicfoundation/hardhat-chai-matchers";

const { deployments, ethers } = require("hardhat");

describe("EmbalmerFacet.rewrapSarcophagus", () => {
  // reset to directly after the diamond deployment before each test
  beforeEach(async () => await deployments.fixture());

  describe("Validates parameters. Should revert if:", function () {
    it("no sarcophagus with the supplied id exists");
    it("the sarcophagus has been compromised");
    it("the sarcophagus has been buried");
    it("the sender is not the embalmer");
    it("the resurrection time has passed");
    it("the new resurrection time is not in the future");
    it("the new resurrection time exceeds sarcophagus maximumRewrapInterval");
  });

  describe("Successfully rewraps a sarcophagus with no accusals", function () {
    it("Should pay digging fees to each of the cursed archaeologists");
    it(
      "Should charge the embalmer the total digging fees for all archaeologists plus the protocol fees"
    );

    it("Should update the resurrectionTime and emit RewrapSarcophagus");
  });
  describe("Successfully rewraps a sarcophagus with fewer than k accusals", function () {
    it("Should not pay digging fees to accused archaeologists");

    it("Should exclude accused archaeologist digging fees from embalmer costs");
  });
});
