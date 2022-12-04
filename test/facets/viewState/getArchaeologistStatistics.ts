import "@nomicfoundation/hardhat-chai-matchers";
import { getContracts } from "../helpers/contracts";
import { registerSarcophagusWithArchaeologists } from "../helpers/sarcophagus";
import time from "../../utils/time";

const { deployments, ethers } = require("hardhat");

describe("ViewStateFacet.getArchaeologistStatistics", () => {
  // reset to directly after the diamond deployment before each test
  beforeEach(async () => await deployments.fixture());

  describe("gets stats", function () {
    it("Should revert if supplied expired sarcophagus parameters", async function () {
      const { viewStateFacet } = await getContracts();
      const { sarcophagusData, archaeologists } =
        await registerSarcophagusWithArchaeologists({});
      await time.increaseTo((await time.latest()) + time.duration.weeks(14));
      await Promise.all(
        archaeologists.map(async (a) => {
          const r = await viewStateFacet.getArchaeologistsStatistics([
            a.archAddress,
          ]);
          console.log(r);
        })
      );
    });
  });
});
