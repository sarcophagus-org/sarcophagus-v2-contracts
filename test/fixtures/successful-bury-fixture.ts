import { BigNumber, ContractTransaction } from "ethers";
import { solidityKeccak256 } from "ethers/lib/utils";
import { deployments } from "hardhat";
import { sign, signMultiple } from "../utils/helpers";
import { setupArchaeologists } from "./setup-archaeologists";

/**
 * A fixture to intialize and finalize a sarcophagus to set up a test that
 * requires a successful initialization and finalization. Not intended to be
 * used for the actual finalizeSarcophagus tests.
 */
export const successfulBuryFixture = deployments.createFixture(
  async ({ deployments, getNamedAccounts, getUnnamedAccounts, ethers }) => {
    // Deploy contracts
    await deployments.fixture();

    const accounts = await getUnnamedAccounts();
    const embalmer = await ethers.getSigner(accounts[0]);
    const recipient = await ethers.getSigner(accounts[1]);

    // Set up the archaeologists and initialize the sarcophagus
    const archaeologists = await setupArchaeologists();
    const arweaveArchaeologist = archaeologists[0];
    const regularArchaeologist = archaeologists[1];

    const diamond = await ethers.getContract("Diamond_DiamondProxy");
    const sarcoToken = await ethers.getContract("SarcoTokenMock");
    const embalmerFacet = await ethers.getContractAt("EmbalmerFacet", diamond.address);
    const archaeologistFacet = await ethers.getContractAt("ArchaeologistFacet", diamond.address);

    const viewStateFacet = await ethers.getContractAt("ViewStateFacet", diamond.address);

    // Transfer 10,000 sarco tokens to the embalmer to be put into free bond
    await sarcoToken.transfer(embalmer.address, BigNumber.from(10_000));

    // Approve the embalmer on the sarco token so transferFrom will work
    await sarcoToken.connect(embalmer).approve(diamond.address, ethers.constants.MaxUint256);

    // Set up the data for the sarcophagus
    const name = "Test Sarcophagus";
    const identifier = solidityKeccak256(["string"], ["unhashedIdentifier"]);
    const canBeTransferred = true;
    // 1 week
    const resurrectionTime = BigNumber.from(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7);
    const minShards = 2;

    for (const archaeologist of archaeologists) {
      // Transfer 10,000 sarco tokens to each archaeologist to be put into free
      // bond
      await sarcoToken.transfer(archaeologist.account, BigNumber.from(10_000));

      // Approve the archaeologist on the sarco token so transferFrom will work
      await sarcoToken
        .connect(archaeologist.signer)
        .approve(diamond.address, ethers.constants.MaxUint256);

      // Deposit some free bond to the contract so initializeSarcophagus will
      // work
      await archaeologistFacet
        .connect(archaeologist.signer)
        .depositFreeBond(BigNumber.from("1000"));
    }

    // Get the regular archaeologist's free bond before bury
    const regularArchaeologistFreeBond = await viewStateFacet.getFreeBond(
      regularArchaeologist.account
    );

    // Get the regular archaeologist's cursed bond before bury
    const regularArchaeologistCursedBond = await viewStateFacet.getCursedBond(
      regularArchaeologist.account
    );

    // Create a sarcophagus as the embalmer
    await embalmerFacet
      .connect(embalmer)
      .initializeSarcophagus(
        name,
        identifier,
        archaeologists,
        arweaveArchaeologist.account,
        recipient.address,
        resurrectionTime,
        canBeTransferred,
        minShards
      );

    const arweaveTxId = "arweaveTxId";
    const arweaveArchSig = await sign(arweaveArchaeologist.signer, arweaveTxId, "string");

    // Get signatures of the identifier from each archaeologist
    const signatures = await signMultiple(
      archaeologists.filter(x => x.account !== arweaveArchaeologist.account).map(x => x.signer),
      identifier
    );

    // Finalize the sarcophagus
    await embalmerFacet
      .connect(embalmer)
      .finalizeSarcophagus(identifier, signatures, arweaveArchSig, arweaveTxId);

    // Get the embalmer's balance before rewrap
    const embalmerBalance = await sarcoToken.balanceOf(embalmer.address);

    // Get the sarco balance of the regular archaeologist before bury
    const regularArchaeologistBalance = await sarcoToken.balanceOf(regularArchaeologist.account);

    const tx: ContractTransaction = await embalmerFacet
      .connect(embalmer)
      .burySarcophagus(identifier);

    return {
      viewStateFacet,
      identifier,
      regularArchaeologist,
      regularArchaeologistFreeBond,
      regularArchaeologistCursedBond,
      sarcoToken,
      regularArchaeologistBalance,
      embalmer,
      archaeologists,
      embalmerBalance,
      tx,
      embalmerFacet,
    };
  }
);
