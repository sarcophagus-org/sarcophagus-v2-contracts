import "@nomiclabs/hardhat-waffle";
import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { generateSarcophagusWithArchaeologists } from "./helpers/sarcophagus";
import time from "../utils/time";
import { getContracts } from "./helpers/contracts";
import { getFreshAccount } from "./helpers/accounts";
import { hashShare } from "./helpers/shamirSecretSharing";
import { BigNumber } from "ethers";
import { getSarquitoBalance } from "./helpers/sarcoToken";

describe("accuse v2", () => {
  // reset to directly after the diamond deployment before each test
  beforeEach(async () => await deployments.fixture());

  it("Should revert on a nonexistent sarcophagus ID", async () => {
    const accuser = await getFreshAccount();

    // generate a nonexistent sarcoId
    const name = "does not exist";
    const sarcoId = ethers.utils.solidityKeccak256(["string"], [name]);

    // run accuse on a nonexistent sarcophagus
    const tx = (await getContracts()).thirdPartyFacet
      .connect(accuser)
      .accuse(sarcoId, [], accuser.address);

    await expect(tx).to.be.revertedWith(
      `SarcophagusDoesNotExist("${sarcoId}")`
    );
  });

  it("Should revert if the current time is past the resurrectionTime", async () => {
    // generate a sarcophagus with a resurrection time 1 week in the future
    const resurrectionTimeSeconds =
      (await time.latest()) + time.duration.weeks(1);
    const { embalmer, sarcophagus } =
      await generateSarcophagusWithArchaeologists({
        totalShares: 5,
        threshold: 3,
        maximumRewrapIntervalSeconds: time.duration.weeks(4),
        resurrectionTimeSeconds: (await time.latest()) + time.duration.weeks(1),
      });

    // set the current time to one week in the future, after the sarcophagus is allowed to be resurrected
    await time.increaseTo(resurrectionTimeSeconds);

    // accuse an archaeologist of leaking a keyshare
    const tx = (await getContracts()).thirdPartyFacet
      .connect(embalmer)
      .accuse(sarcophagus.sarcoId, [], embalmer.address);

    await expect(tx).to.be.revertedWith(`SarcophagusIsUnwrappable()`);
  });

  it("On a successful accusal of an archaeologist, should transfer the correct amount of funds to embalmer and accuser, slash the archaeologist's bond, mark the arch as accused, and emit an AccuseArchaeologist event", async () => {
    const { thirdPartyFacet, sarcoToken } = await getContracts();
    const accuser = await getFreshAccount();
    const { embalmer, sarcophagus, archaeologists } =
      await generateSarcophagusWithArchaeologists({
        totalShares: 5,
        threshold: 3,
        maximumRewrapIntervalSeconds: time.duration.weeks(4),
        resurrectionTimeSeconds: (await time.latest()) + time.duration.weeks(3),
      });
    const accusedArchaeologist = archaeologists[0];

    // save the sarquito balance of the embalmer prior to the accusal
    const embalmerPreAccuseSarquitoBalance = await getSarquitoBalance(
      embalmer.address
    );

    // accuse the archaeologist of leaking a keyshare
    const tx = (await getContracts()).thirdPartyFacet
      .connect(accuser)
      .accuse(
        sarcophagus.sarcoId,
        [hashShare(accusedArchaeologist.share)],
        accuser.address
      );

    // verify that AccuseArchaeologist is emitted
    await expect(tx).to.emit(thirdPartyFacet, `AccuseArchaeologist`);

    // verify that the accuser receives half of archaeologist cursed bond (equal to digging fee)
    expect(await getSarquitoBalance(accuser.address)).to.equal(
      BigNumber.from(accusedArchaeologist.diggingFee).div(2).toString()
    );

    const embalmerPostAccuseSarquitoBalance = await getSarquitoBalance(
      embalmer.address
    );
    // verify embalmer receives half of archaeologist cursed bond plus full digging fee
    expect(
      embalmerPostAccuseSarquitoBalance
        .sub(embalmerPreAccuseSarquitoBalance)
        .toString()
    ).to.equal(
      BigNumber.from(accusedArchaeologist.diggingFee)
        .div(2)
        .add(BigNumber.from(accusedArchaeologist.diggingFee))
        .toString()
    );

    // verify accused archaeologist bond has been slashed
    // verify accused archaeologist has been marked as accused
    // verify the accused archaeologist has been added to archaeologistAccusals
  });

  // it("Should not refund bonds to other archaeologists or change sarcophagus state if less than k archaeologists have been accused", async () => {});
  // it("Should refund digging fees allocated by embalmer to an accused archaeologist on their first accusal", async () => {});
  // it("Should not pay out digging fees allocated by embalmer to an accused archaeologist if they've already been accused once", async () => {});
  // it("Should not pay out any funds on the second accusal of an archaeologist who has already been accused", async () => {});
  // it("Should allow accusal of 2 archaeologists on a 3 of 5 sarcophagus without freeing all other archaeologists", async () => {});
  // it("Should free all unaccused archaeologists upon successful accusal of 3 archaeologists on a 3 of 5 sarcophagus and update state to accused", async () => {});
  // it("Should free all unaccused archaeologists upon successful accusal of 1 archaeologist on a 3 of 5 sarcophagus where 2 have been accused on a previous call and update state to accused", async () => {});

  // todo: can an async context be used with mocha?
  // context(
  //   "On a successful accusal of a single archaeologist on a sarcophagus with no prior accusals",
  //   async () => {
  //     const { thirdPartyFacet, sarcoToken } = await getContracts();
  //     const accuser = await getFreshAccount();
  //
  //     const { embalmer, sarcophagus, archaeologists } =
  //       await generateSarcophagusWithArchaeologists({
  //         totalShares: 5,
  //         threshold: 3,
  //         maximumRewrapIntervalSeconds: time.duration.weeks(4),
  //         resurrectionTimeSeconds:
  //           (await time.latest()) + time.duration.weeks(3),
  //       });
  //
  //     const accusedArchaeologist = archaeologists[0];
  //     // hash the leaked keyshare
  //     const hashedShare = hashShare(accusedArchaeologist.share);
  //
  //     const embalmerPreAccuseSarquitoBalance = await sarcoToken.balanceOf(
  //       embalmer.address
  //     );
  //
  //     // accuse an archaeologist of leaking a keyshare
  //     const tx = (await getContracts()).thirdPartyFacet
  //       .connect(accuser)
  //       .accuse(sarcophagus.sarcoId, [hashedShare], accuser.address);
  //
  //     // verify AccuseArchaeologist is emitted
  //     it("Should emit AccuseArchaeologist", async () => {
  //       await expect(tx).to.emit(thirdPartyFacet, `AccuseArchaeologist`);
  //     });
  //
  //     // verify accuser receives half of archaeologist cursed bond (equal to digging fee)
  //     it("Should transfer half of the archaeologist's cursed bond to the supplied payment address", async () => {
  //       expect(await sarcoToken.balanceOf(accuser.address)).to.equal(
  //         BigNumber.from(accusedArchaeologist.diggingFee).div(2).toString()
  //       );
  //     });
  //
  //     // verify embalmer receives half of archaeologist cursed bond plus full digging fee
  //     it("Should transfer half of the archaeologist's cursed bond plus the digging fees to the embalmer", async () => {
  //       const embalmerPostAccuseSarquitoBalance = await sarcoToken.balanceOf(
  //         embalmer.address
  //       );
  //       expect(
  //         embalmerPostAccuseSarquitoBalance
  //           .sub(embalmerPreAccuseSarquitoBalance)
  //           .toString()
  //       ).to.equal(
  //         BigNumber.from(accusedArchaeologist.diggingFee)
  //           .div(2)
  //           .add(BigNumber.from(accusedArchaeologist.diggingFee))
  //           .toString()
  //       );
  //     });
  //
  //     // verify accused archaeologist bond has been slashed
  //     // verify accused archaeologist has been marked as accused
  //     // verify the accused archaeologist has been added to archaeologistAccusals
  //   }
  // );
});
