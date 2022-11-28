import "@nomicfoundation/hardhat-chai-matchers";

const { deployments, ethers } = require("hardhat");

describe("EmbalmerFacet.burySarcophagus", () => {
  // reset to directly after the diamond deployment before each test
  beforeEach(async () => await deployments.fixture());

  describe("Validates parameters. Should revert if:", function () {
    it("no sarcophagus with the supplied id exists");
    it("the sarcophagus has been compromised");
    it("the sarcophagus has been buried");
    it("the sender is not the embalmer");
    it("the resurrection time has passed");
  });

  describe("Successfully buries a sarcophagus with no accusals", function () {
    it("Should pay digging fees to each of the cursed archaeologists");
    it("Should unlock the bonds of each of the cursed archaeologists");
    it("Should update the resurrectionTime and emit BurySarcophagus");
  });
  describe("Successfully buries a sarcophagus with fewer than k accusals", function () {
    it("Should not pay digging fees to the accused cursed archaeologists");
    it("Should not increase the free bonds of the accused archaeologists");
  });
});
