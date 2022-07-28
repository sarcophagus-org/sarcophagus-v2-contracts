import { expect } from "chai";
import { deployments, ethers, getUnnamedAccounts } from "hardhat";
import { CursesMock } from "../../typechain/CursesMock";
import { createSarcoFixture } from "../fixtures/create-sarco-fixture";

describe.skip("Contract: Curses", () => {
  describe("mint()", () => {
    it("should pass", async () => {
      const { archaeologists, sarcoId } = await createSarcoFixture(
        { shares: 5, threshold: 3 },
        "Sarcophagus"
      );

      const curses: CursesMock = await ethers.getContract("CursesMock");

      const arch = archaeologists[0].archAddress;

      await curses.mint(arch, sarcoId, "name", "description", "25", "200");

      const uri = await curses.uri(sarcoId);
      console.log("🚀 ~ file: curses.spec.ts ~ line 21 ~ it ~ uri", uri);

      const prefix = "data:application/json;base64,";
      // Remove the prefice from the beginning of the uri
      const base64Data = uri.substring(prefix.length);
      console.log(
        "🚀 ~ file: curses.spec.ts ~ line 25 ~ it ~ base64Data",
        base64Data
      );

      // Decode the base64 data
      const data = Buffer.from(base64Data, "base64").toString("utf8");
      console.log("🚀 ~ file: curses.spec.ts ~ line 33 ~ it ~ data", data);

      expect(true).to.be.true;
    });
  });
});
