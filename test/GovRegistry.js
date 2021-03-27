const { expect } = require("chai");
const { utils } = require("ethers/lib");
const { parseEther, parseUnits } = require("ethers/lib/utils");
const { constants } = require("ethers");
const { insurance, erc20, tvl, blockNumber } = require("./utils.js");
const { TimeTraveler } = require("./utils-snapshot.js");

const PROTOCOL_X =
  "0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7";

describe("Gov Registry tests", function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);

    [owner, alice] = await ethers.getSigners();
    [owner.address, alice.address] = [
      await owner.getAddress(),
      await alice.getAddress(),
    ];
    const Token = await ethers.getContractFactory("MockToken");
    [tokenA, tokenB, tokenC] = [
      await Token.deploy("TokenA", "A", parseEther("1000")),
      await Token.deploy("TokenB", "B", parseEther("1000")),
      await Token.deploy("TokenC", "C", parseEther("1000")),
    ];

    const Stake = await ethers.getContractFactory("Stake");
    [stakeA, stakeB, stakeC] = [
      await Stake.deploy("Stake TokenA", "stkA"),
      await Stake.deploy("Stake TokenB", "stkB"),
      await Stake.deploy("Stake TokenC", "stkC"),
    ];

    insure = await insurance(owner.address);
    await insure.setInitialGovInsurance(owner.address);
    await tokenA.approve(insure.address, constants.MaxUint256);
    await tokenB.approve(insure.address, constants.MaxUint256);
    await tokenC.approve(insure.address, constants.MaxUint256);
    await stakeA.transferOwnership(insure.address);
    await stakeB.transferOwnership(insure.address);
    await stakeC.transferOwnership(insure.address);

    await insure.tokenAdd(tokenA.address, stakeA.address, owner.address);
    await insure.tokenAdd(tokenC.address, stakeC.address, owner.address);
    await insure.protocolAdd(PROTOCOL_X, owner.address, owner.address);

    await timeTraveler.snapshot();
  });
  it("Initial state", async function () {
    expect(await insure.getTotalPremiumPerBlock(tokenA.address)).to.eq(0);
    expect(await insure.getPremiumLastPaid(tokenA.address)).to.eq(0);
  });
  describe("setProtocolPremiums()", function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it("Non whitelist", async function () {
      await expect(
        insure.setProtocolPremiums(
          PROTOCOL_X,
          [tokenB.address],
          [parseEther("1")]
        )
      ).to.be.revertedWith("WHITELIST");
    });
    it("Non whitelist mulitple", async function () {
      await expect(
        insure.setProtocolPremiums(
          PROTOCOL_X,
          [tokenB.address, tokenB.address],
          [parseEther("1"), parseEther("1")]
        )
      ).to.be.revertedWith("WHITELIST");
    });
    it("Set", async function () {
      const block = await blockNumber(
        insure.setProtocolPremiums(
          PROTOCOL_X,
          [tokenA.address],
          [parseEther("1")]
        )
      );
      expect(await insure.getTotalPremiumPerBlock(tokenA.address)).to.eq(
        parseEther("1")
      );
      expect(await insure.getPremiumLastPaid(tokenA.address)).to.eq(block);
    });
    it("Set again", async function () {
      // TODO test payOffDebtAll (in other test)
      await ethers.provider.send("evm_mine");
      const block = await blockNumber(
        insure.setProtocolPremiums(
          PROTOCOL_X,
          [tokenA.address],
          [parseEther("10")]
        )
      );
      expect(await insure.getTotalPremiumPerBlock(tokenA.address)).to.eq(
        parseEther("10")
      );
      expect(await insure.getPremiumLastPaid(tokenA.address)).to.eq(block);
    });
    it("Set multiple", async function () {
      const block = await blockNumber(
        insure.setProtocolPremiums(
          PROTOCOL_X,
          [tokenA.address, tokenC.address],
          [parseEther("1"), parseEther("5")]
        )
      );
      expect(await insure.getTotalPremiumPerBlock(tokenA.address)).to.eq(
        parseEther("1")
      );
      expect(await insure.getPremiumLastPaid(tokenA.address)).to.eq(block);
      expect(await insure.getTotalPremiumPerBlock(tokenC.address)).to.eq(
        parseEther("5")
      );
      expect(await insure.getPremiumLastPaid(tokenC.address)).to.eq(block);
    });
  });
});
