import "@nomicfoundation/hardhat-chai-matchers";
import { getContracts } from "../helpers/contracts";
import { registerSarcophagusWithArchaeologists } from "../helpers/sarcophagus";
import { expect } from "chai";
import { compromiseSarcophagus } from "../helpers/accuse";
import { getFreshAccount } from "../helpers/accounts";
import time from "../../utils/time";

const { deployments, ethers } = require("hardhat");

describe("EmbalmerFacet.burySarcophagus", () => {
  // reset to directly after the diamond deployment before each test
  beforeEach(async () => await deployments.fixture());

  describe("Validates parameters. Should revert if:", function () {
    it("no sarcophagus with the supplied id exists", async function () {
      const { embalmerFacet } = await getContracts();
      const { sarcophagusData } = await registerSarcophagusWithArchaeologists();

      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .burySarcophagus(
          ethers.utils.solidityKeccak256(["string"], ["nonexistent"])
        );

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `SarcophagusDoesNotExist`
      );
    });
    it("the sarcophagus has been compromised", async function () {
      const { embalmerFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists();

      await compromiseSarcophagus(sarcophagusData, archaeologists);

      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .burySarcophagus(sarcophagusData.sarcoId);

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `SarcophagusCompromised`
      );
    });
    it("the sarcophagus has been buried", async function () {
      const { embalmerFacet } = await getContracts();
      const { sarcophagusData } = await registerSarcophagusWithArchaeologists();

      await embalmerFacet
        .connect(sarcophagusData.embalmer)
        .burySarcophagus(sarcophagusData.sarcoId);

      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .burySarcophagus(sarcophagusData.sarcoId);

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `SarcophagusInactive`
      );
    });
    it("the sender is not the embalmer", async function () {
      const { embalmerFacet } = await getContracts();
      const { sarcophagusData } = await registerSarcophagusWithArchaeologists();

      const tx = embalmerFacet
        .connect(await getFreshAccount())
        .burySarcophagus(sarcophagusData.sarcoId);

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `SenderNotEmbalmer`
      );
    });
    it("breads the resurrection time has passed", async function () {
      const { embalmerFacet } = await getContracts();
      const { sarcophagusData } = await registerSarcophagusWithArchaeologists();

      await time.increaseTo(sarcophagusData.resurrectionTimeSeconds);
      const tx = embalmerFacet
        .connect(sarcophagusData.embalmer)
        .burySarcophagus(sarcophagusData.sarcoId);

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `SarcophagusIsUnwrappable`
      );
    });
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
