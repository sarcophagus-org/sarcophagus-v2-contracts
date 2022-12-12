import "@nomicfoundation/hardhat-chai-matchers";
import { getContracts } from "../helpers/contracts";
import { expect } from "chai";
import { registerSarcophagusWithArchaeologists } from "../helpers/sarcophagus";
import {
  accuseArchaeologistsOnSarcophagus,
  compromiseSarcophagus,
} from "../helpers/accuse";
import {
  setTimeToAfterEmbalmerClaimWindowEnd,
  setTimeToEmbalmerClaimWindowStart,
} from "../helpers/clean";
import { getDeployer, getFreshAccount } from "../helpers/accounts";
import { ArchaeologistData } from "../helpers/archaeologistSignature";
import { BigNumber } from "ethers";
import {
  getArchaeologistAddressesToFreeBondSarquitos,
  getArchaeologistAddressesToLockedBondSarquitos,
  getArchaeologistFreeBondSarquitos,
  getArchaeologistLockedBondSarquitos,
} from "../helpers/bond";
import { getTotalDiggingFeesSarquitos } from "../helpers/diggingFees";
import { getSarquitoBalance } from "../helpers/sarcoToken";
import { publishKeySharesForArchaeologists } from "../helpers/publish";

const { deployments, ethers } = require("hardhat");

describe("ThirdPartyFacet.clean", () => {
  // reset to directly after the diamond deployment before each test
  beforeEach(async () => await deployments.fixture());

  describe("Validates parameters. Should revert if:", function () {
    it("no sarcophagus with the supplied id exists", async function () {
      const { thirdPartyFacet } = await getContracts();
      const { sarcophagusData } = await registerSarcophagusWithArchaeologists();
      await setTimeToEmbalmerClaimWindowStart(
        sarcophagusData.resurrectionTimeSeconds
      );
      const tx = thirdPartyFacet
        .connect(sarcophagusData.embalmer)
        .clean(ethers.utils.solidityKeccak256(["string"], ["nonexistent"]));

      await expect(tx).to.be.revertedWithCustomError(
        thirdPartyFacet,
        `SarcophagusDoesNotExist`
      );
    });
    it("called by embalmer after the embalmerCleanWindow has passed", async function () {
      const { thirdPartyFacet } = await getContracts();
      const { sarcophagusData } = await registerSarcophagusWithArchaeologists();
      await setTimeToAfterEmbalmerClaimWindowEnd(
        sarcophagusData.resurrectionTimeSeconds
      );
      const tx = thirdPartyFacet
        .connect(sarcophagusData.embalmer)
        .clean(sarcophagusData.sarcoId);
      await expect(tx).to.be.revertedWithCustomError(
        thirdPartyFacet,
        `EmbalmerClaimWindowPassed`
      );
    });
    it("called by admin before the embalmerCleanWindow has passed but after the resurrectionTime + gracePeriod have passed", async function () {
      const { thirdPartyFacet } = await getContracts();
      const { sarcophagusData } = await registerSarcophagusWithArchaeologists();
      await setTimeToEmbalmerClaimWindowStart(
        sarcophagusData.resurrectionTimeSeconds
      );
      const admin = await getDeployer();
      const tx = thirdPartyFacet.connect(admin).clean(sarcophagusData.sarcoId);
      await expect(tx).to.be.revertedWithCustomError(
        thirdPartyFacet,
        `TooEarlyForAdminClean`
      );
    });
    it("called by third party during embalmerClaimWindow", async function () {
      const { thirdPartyFacet } = await getContracts();
      const { sarcophagusData } = await registerSarcophagusWithArchaeologists();
      await setTimeToEmbalmerClaimWindowStart(
        sarcophagusData.resurrectionTimeSeconds
      );
      const thirdParty = await getFreshAccount();
      const tx = thirdPartyFacet
        .connect(thirdParty)
        .clean(sarcophagusData.sarcoId);
      await expect(tx).to.be.revertedWithCustomError(
        thirdPartyFacet,
        `SenderNotEmbalmerOrAdmin`
      );
    });
    it("called by third party after embalmerClaimWindow", async function () {
      const { thirdPartyFacet } = await getContracts();
      const { sarcophagusData } = await registerSarcophagusWithArchaeologists();
      await setTimeToAfterEmbalmerClaimWindowEnd(
        sarcophagusData.resurrectionTimeSeconds
      );
      const thirdParty = await getFreshAccount();
      const tx = thirdPartyFacet
        .connect(thirdParty)
        .clean(sarcophagusData.sarcoId);
      await expect(tx).to.be.revertedWithCustomError(
        thirdPartyFacet,
        `SenderNotEmbalmerOrAdmin`
      );
    });

    it("sarcophagus is compromised", async function () {
      const { thirdPartyFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists();

      await compromiseSarcophagus(sarcophagusData, archaeologists);
      await setTimeToEmbalmerClaimWindowStart(
        sarcophagusData.resurrectionTimeSeconds
      );
      const tx = thirdPartyFacet
        .connect(sarcophagusData.embalmer)
        .clean(sarcophagusData.sarcoId);

      await expect(tx).to.be.revertedWithCustomError(
        thirdPartyFacet,
        `SarcophagusCompromised`
      );
    });
    it("sarcophagus is cleaned", async function () {
      const { thirdPartyFacet } = await getContracts();
      const { sarcophagusData } = await registerSarcophagusWithArchaeologists();
      await setTimeToEmbalmerClaimWindowStart(
        sarcophagusData.resurrectionTimeSeconds
      );
      await thirdPartyFacet
        .connect(sarcophagusData.embalmer)
        .clean(sarcophagusData.sarcoId);
      const tx = thirdPartyFacet
        .connect(sarcophagusData.embalmer)
        .clean(sarcophagusData.sarcoId);

      await expect(tx).to.be.revertedWithCustomError(
        thirdPartyFacet,
        `SarcophagusAlreadyCleaned`
      );
    });
    it("sarcophagus is buried", async function () {
      const { embalmerFacet, thirdPartyFacet } = await getContracts();
      const { sarcophagusData } = await registerSarcophagusWithArchaeologists();

      await embalmerFacet
        .connect(sarcophagusData.embalmer)
        .burySarcophagus(sarcophagusData.sarcoId);
      await setTimeToEmbalmerClaimWindowStart(
        sarcophagusData.resurrectionTimeSeconds
      );
      const tx = thirdPartyFacet
        .connect(sarcophagusData.embalmer)
        .clean(sarcophagusData.sarcoId);

      await expect(tx).to.be.revertedWithCustomError(
        embalmerFacet,
        `SarcophagusInactive`
      );
    });
  });

  describe("Successfully cleans a sarcophagus  ", function () {
    it("emits a Clean event", async function () {
      const { thirdPartyFacet } = await getContracts();
      const { sarcophagusData } = await registerSarcophagusWithArchaeologists();
      await setTimeToEmbalmerClaimWindowStart(
        sarcophagusData.resurrectionTimeSeconds
      );
      const tx = thirdPartyFacet
        .connect(sarcophagusData.embalmer)
        .clean(sarcophagusData.sarcoId);

      await expect(tx).to.emit(thirdPartyFacet, `Clean`);
    });
    it("sets isCleaned to true on the sarcophagus", async function () {
      const { thirdPartyFacet, viewStateFacet } = await getContracts();
      const { sarcophagusData } = await registerSarcophagusWithArchaeologists();
      await setTimeToEmbalmerClaimWindowStart(
        sarcophagusData.resurrectionTimeSeconds
      );
      await thirdPartyFacet
        .connect(sarcophagusData.embalmer)
        .clean(sarcophagusData.sarcoId);

      const sarcophagus = await viewStateFacet.getSarcophagus(
        sarcophagusData.sarcoId
      );
      expect(sarcophagus.isCleaned).to.be.true;
    });

    it("does not transfer bonds or digging fees for accused archaeologists", async function () {
      const { thirdPartyFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists({
          totalShares: 7,
          threshold: 4,
        });

      // accuse first 3 archaeologists
      const { accusedArchaeologists } = await accuseArchaeologistsOnSarcophagus(
        3,
        sarcophagusData.sarcoId,
        archaeologists
      );

      // have non accused archaeologists publish their keyshares
      await publishKeySharesForArchaeologists(
        sarcophagusData,
        archaeologists.slice(3, 7)
      );

      // save starting embalmer balance before clean
      const embalmerPreCleanSarquitoBalance = await getSarquitoBalance(
        sarcophagusData.embalmer.address
      );
      // save the locked bonds of each accused archaeologist
      const accusedArchaeologistAddressesToInitialLockedBondsSarquitos =
        await getArchaeologistAddressesToLockedBondSarquitos(
          accusedArchaeologists
        );
      // save the free bonds of each accused archaeologist
      const accusedArchaeologistAddressesToInitialFreeBondsSarquitos =
        await getArchaeologistAddressesToFreeBondSarquitos(
          accusedArchaeologists
        );

      await setTimeToEmbalmerClaimWindowStart(
        sarcophagusData.resurrectionTimeSeconds
      );
      // clean the sarcophagus
      await thirdPartyFacet
        .connect(sarcophagusData.embalmer)
        .clean(sarcophagusData.sarcoId);

      // verify that all accused archaeologists have not had their locked or free bonds altered
      await Promise.all(
        accusedArchaeologists.map(
          async (accusedArchaeologist: ArchaeologistData) => {
            const currentLockedBond = await getArchaeologistLockedBondSarquitos(
              accusedArchaeologist.archAddress
            );
            expect(currentLockedBond).to.equal(
              accusedArchaeologistAddressesToInitialLockedBondsSarquitos.get(
                accusedArchaeologist.archAddress
              )
            );
            const currentFreeBond = await getArchaeologistFreeBondSarquitos(
              accusedArchaeologist.archAddress
            );
            expect(currentFreeBond).to.equal(
              accusedArchaeologistAddressesToInitialFreeBondsSarquitos.get(
                accusedArchaeologist.archAddress
              )
            );
          }
        )
      );

      // verify embalmer has not received funds from the clean
      expect(
        await getSarquitoBalance(sarcophagusData.embalmer.address)
      ).to.equal(embalmerPreCleanSarquitoBalance);
    });
    it("does not transfer bonds or digging fees for archaeologists that have published their key shares", async function () {
      const { thirdPartyFacet, viewStateFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists();

      await publishKeySharesForArchaeologists(sarcophagusData, archaeologists);

      // save starting protocol fees before clean
      const startingProtocolFees = await viewStateFacet.getTotalProtocolFees();

      // save the locked bonds of each archaeologist
      const archaeologistAddressesToInitialLockedBondsSarquitos =
        await getArchaeologistAddressesToLockedBondSarquitos(archaeologists);
      // save the free bonds of each archaeologist
      const archaeologistAddressesToInitialFreeBondsSarquitos =
        await getArchaeologistAddressesToFreeBondSarquitos(archaeologists);

      await setTimeToEmbalmerClaimWindowStart(
        sarcophagusData.resurrectionTimeSeconds
      );
      // clean the sarcophagus
      await thirdPartyFacet
        .connect(sarcophagusData.embalmer)
        .clean(sarcophagusData.sarcoId);

      // verify that all accused archaeologists have not had their locked or free bonds altered
      await Promise.all(
        archaeologists.map(async (archaeologist: ArchaeologistData) => {
          const currentLockedBond = await getArchaeologistLockedBondSarquitos(
            archaeologist.archAddress
          );
          expect(currentLockedBond).to.equal(
            archaeologistAddressesToInitialLockedBondsSarquitos.get(
              archaeologist.archAddress
            )
          );
          const currentFreeBond = await getArchaeologistFreeBondSarquitos(
            archaeologist.archAddress
          );
          expect(currentFreeBond).to.equal(
            archaeologistAddressesToInitialFreeBondsSarquitos.get(
              archaeologist.archAddress
            )
          );
        })
      );

      // verify embalmer has not received funds from the clean
      expect(await viewStateFacet.getTotalProtocolFees()).to.equal(
        startingProtocolFees
      );
    });

    it("bread stores the sarcoId and archaeologist address in archaeologistCleanups", async function () {
      const { thirdPartyFacet, viewStateFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists({
          totalShares: 7,
          threshold: 4,
        });

      const nonPublishingArchaeologists = archaeologists.slice(0, 3);
      const publishingArchaeologists = archaeologists.slice(3, 7);
      await publishKeySharesForArchaeologists(
        sarcophagusData,
        publishingArchaeologists
      );

      await setTimeToEmbalmerClaimWindowStart(
        sarcophagusData.resurrectionTimeSeconds
      );
      await thirdPartyFacet
        .connect(sarcophagusData.embalmer)
        .clean(sarcophagusData.sarcoId);

      // verify that all archaeologists that have published their key shares have not had a clean counted against them
      await Promise.all(
        publishingArchaeologists.map(
          async (archaeologist: ArchaeologistData) => {
            const cleanUpCount =
              await viewStateFacet.getArchaeologistCleanupsCount(
                archaeologist.archAddress
              );
            expect(cleanUpCount).to.equal(0);
          }
        )
      );

      // verify that all archaeologists that have failed to publish their key shares have had a clean counted
      await Promise.all(
        nonPublishingArchaeologists.map(
          async (archaeologist: ArchaeologistData) => {
            const cleanUpCount =
              await viewStateFacet.getArchaeologistCleanupsCount(
                archaeologist.archAddress
              );
            expect(cleanUpCount).to.equal(1);
          }
        )
      );
    });
  });

  describe("Handles payout to the embalmer", function () {
    it("transfers all locked bonds and digging fees for archaeologists that have failed to supply keyshares to the embalmer", async function () {
      const { thirdPartyFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists({
          totalShares: 7,
          threshold: 4,
        });
      const nonPublishingArchaeologists = archaeologists.slice(0, 3);

      // have publishing archaeologists publish their key shares
      const publishingArchaeologists = archaeologists.slice(3, 7);
      await publishKeySharesForArchaeologists(
        sarcophagusData,
        publishingArchaeologists
      );

      // save starting embalmer balance before clean
      const embalmerPreCleanSarquitoBalance = await getSarquitoBalance(
        sarcophagusData.embalmer.address
      );
      // save the locked bonds of each archaeologist that has failed to publish key shares before clean is called
      const nonPublishingArchaeologistAddressesToInitialLockedBondsSarquitos =
        await getArchaeologistAddressesToLockedBondSarquitos(
          nonPublishingArchaeologists
        );

      await setTimeToEmbalmerClaimWindowStart(
        sarcophagusData.resurrectionTimeSeconds
      );
      // clean the sarcophagus
      await thirdPartyFacet
        .connect(sarcophagusData.embalmer)
        .clean(sarcophagusData.sarcoId);

      // verify that all archaeologists that have failed to publish key shares have had their locked bonds slashed
      await Promise.all(
        nonPublishingArchaeologists.map(
          async (nonPublishingArchaeologist: ArchaeologistData) => {
            const balanceAfterClean = await getArchaeologistLockedBondSarquitos(
              nonPublishingArchaeologist.archAddress
            );
            expect(balanceAfterClean).to.equal(
              nonPublishingArchaeologistAddressesToInitialLockedBondsSarquitos
                .get(nonPublishingArchaeologist.archAddress)!
                .sub(nonPublishingArchaeologist.diggingFeeSarquitos)
            );
          }
        )
      );

      // verify embalmer has been paid the digging fees for all non publishing archaeologists
      // plus the locked bonds for all non publishing archaeologists
      const combinedDiggingFeesSarquito: BigNumber =
        getTotalDiggingFeesSarquitos(nonPublishingArchaeologists);
      expect(
        await getSarquitoBalance(sarcophagusData.embalmer.address)
      ).to.equal(
        embalmerPreCleanSarquitoBalance.add(combinedDiggingFeesSarquito.mul(2))
      );
    });
    it("does not transfer any funds to the embalmer if all archaeologists have supplied keyshares", async function () {
      const { thirdPartyFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists();
      // have all archaeologists publish their key shares
      await publishKeySharesForArchaeologists(sarcophagusData, archaeologists);

      // save starting embalmer balance before clean
      const embalmerPreCleanSarquitoBalance = await getSarquitoBalance(
        sarcophagusData.embalmer.address
      );

      await setTimeToEmbalmerClaimWindowStart(
        sarcophagusData.resurrectionTimeSeconds
      );
      // clean the sarcophagus
      await thirdPartyFacet
        .connect(sarcophagusData.embalmer)
        .clean(sarcophagusData.sarcoId);

      // verify embalmer has not received any funds
      expect(
        await getSarquitoBalance(sarcophagusData.embalmer.address)
      ).to.equal(embalmerPreCleanSarquitoBalance);
    });
  });

  describe("Handles payout to the admin", function () {
    it("transfers all locked bonds and digging fees for archaeologists that have failed to supply keyshares to the protocol fees", async function () {
      const { thirdPartyFacet, viewStateFacet, archaeologistFacet } =
        await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists({
          totalShares: 7,
          threshold: 4,
        });
      const nonPublishingArchaeologists = archaeologists.slice(0, 3);

      // have publishing archaeologists publish their key shares
      const publishingArchaeologists = archaeologists.slice(3, 7);
      await publishKeySharesForArchaeologists(
        sarcophagusData,
        publishingArchaeologists
      );

      // save starting protocol fees before clean
      const startingProtocolFees = await viewStateFacet.getTotalProtocolFees();
      // save the locked bonds of each archaeologist that has failed to publish key shares before clean is called
      const nonPublishingArchaeologistAddressesToInitialLockedBondsSarquitos =
        await getArchaeologistAddressesToLockedBondSarquitos(
          nonPublishingArchaeologists
        );

      await setTimeToAfterEmbalmerClaimWindowEnd(
        sarcophagusData.resurrectionTimeSeconds
      );
      // clean the sarcophagus
      await thirdPartyFacet
        .connect(await getDeployer())
        .clean(sarcophagusData.sarcoId);

      // verify that all archaeologists that have failed to publish key shares have had their locked bonds slashed
      await Promise.all(
        nonPublishingArchaeologists.map(
          async (nonPublishingArchaeologist: ArchaeologistData) => {
            const balanceAfterClean = await getArchaeologistLockedBondSarquitos(
              nonPublishingArchaeologist.archAddress
            );
            expect(balanceAfterClean).to.equal(
              nonPublishingArchaeologistAddressesToInitialLockedBondsSarquitos
                .get(nonPublishingArchaeologist.archAddress)!
                .sub(nonPublishingArchaeologist.diggingFeeSarquitos)
            );
          }
        )
      );

      // verify protocol fees have been increased by the digging fees for all non publishing archaeologists
      // plus the locked bonds for all non publishing archaeologists
      const combinedDiggingFeesSarquito: BigNumber =
        getTotalDiggingFeesSarquitos(nonPublishingArchaeologists);

      expect(await viewStateFacet.getTotalProtocolFees()).to.equal(
        startingProtocolFees.add(combinedDiggingFeesSarquito.mul(2))
      );
    });
    it("does not transfer any funds to protocol fees if all archaeologists have supplied keyshares", async function () {
      const { thirdPartyFacet, viewStateFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists();
      // have all archaeologists publish their key shares
      await publishKeySharesForArchaeologists(sarcophagusData, archaeologists);

      // save starting protocol fees before clean
      const startingProtocolFees = await viewStateFacet.getTotalProtocolFees();

      await setTimeToAfterEmbalmerClaimWindowEnd(
        sarcophagusData.resurrectionTimeSeconds
      );
      // clean the sarcophagus
      await thirdPartyFacet
        .connect(await getDeployer())
        .clean(sarcophagusData.sarcoId);

      // verify protocol fees have not been increased
      expect(await viewStateFacet.getTotalProtocolFees()).to.equal(
        startingProtocolFees
      );
    });
  });
});
