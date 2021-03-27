const { expect } = require("chai");
const { utils } = require("ethers/lib");
const { parseEther, parseUnits } = require("ethers/lib/utils");
const { constants } = require("ethers");
const { insurance, erc20, tvl, blockNumber } = require("./utils.js");
const { TimeTraveler } = require("./utils-snapshot.js");

const PROTOCOL_X =
  "0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7";

describe("Gov Insurance tests", function () {
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

    await timeTraveler.snapshot();
  });
  it("Initial state", async function () {
    expect(await insure.getGovInsurance()).to.eq(owner.address);
    expect(await insure.getClaimPeriod()).to.eq(0);
    expect(await insure.getTimeLock()).to.eq(0);
    expect(await insure.getProtocolIsCovered(PROTOCOL_X)).to.eq(false);
    expect(await insure.getProtocolManager(PROTOCOL_X)).to.eq(
      constants.AddressZero
    );
    expect(await insure.getProtocolAgent(PROTOCOL_X)).to.eq(
      constants.AddressZero
    );

    tokens = await insure.getTokens();
    expect(tokens.length).to.eq(0);
    await expect(insure.isInitialized(tokenA.address)).to.be.revertedWith(
      "INVALID_TOKEN"
    );
  });
  describe("transferGovInsurance()", function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it("Transfer", async function () {
      await insure.transferGovInsurance(alice.address);
      expect(await insure.getGovInsurance()).to.eq(alice.address);
    });
  });
  describe("setClaimPeriod()", function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it("Set", async function () {
      await insure.setClaimPeriod(100);
      expect(await insure.getClaimPeriod()).to.eq(100);
    });
  });
  describe("setTimeLock()", function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it("Set", async function () {
      await insure.setTimeLock(500);
      expect(await insure.getTimeLock()).to.eq(500);
    });
  });
  describe("protocolAdd()", function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it("Add", async function () {
      await insure.protocolAdd(PROTOCOL_X, owner.address, owner.address);
      expect(await insure.getProtocolIsCovered(PROTOCOL_X)).to.eq(true);
      expect(await insure.getProtocolManager(PROTOCOL_X)).to.eq(owner.address);
      expect(await insure.getProtocolAgent(PROTOCOL_X)).to.eq(owner.address);
    });
  });
  describe("protocolUpdate()", function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await insure.protocolAdd(PROTOCOL_X, owner.address, owner.address);
    });
    it("Update", async function () {
      await insure.protocolUpdate(PROTOCOL_X, alice.address, alice.address);
      expect(await insure.getProtocolIsCovered(PROTOCOL_X)).to.eq(true);
      expect(await insure.getProtocolManager(PROTOCOL_X)).to.eq(alice.address);
      expect(await insure.getProtocolAgent(PROTOCOL_X)).to.eq(alice.address);
    });
  });
  describe("protocolRemove(), not active", function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await insure.protocolAdd(PROTOCOL_X, owner.address, owner.address);
    });
    it("Remove", async function () {
      await insure.protocolRemove(PROTOCOL_X);
      expect(await insure.getProtocolIsCovered(PROTOCOL_X)).to.eq(false);
      expect(await insure.getProtocolManager(PROTOCOL_X)).to.eq(
        constants.AddressZero
      );
      expect(await insure.getProtocolAgent(PROTOCOL_X)).to.eq(
        constants.AddressZero
      );
    });
  });
  describe("protocolRemove(), debt", function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await insure.protocolAdd(PROTOCOL_X, owner.address, owner.address);
      await insure.tokenAdd(tokenA.address, stakeA.address, owner.address);
      await insure.depositProtocolBalance(
        PROTOCOL_X,
        parseEther("100"),
        tokenA.address
      );
      blockNumberStart = await blockNumber(
        insure.setProtocolPremiums(
          PROTOCOL_X,
          [tokenA.address],
          [parseEther("1")]
        )
      );
    });
    it("Remove fail", async function () {
      await expect(insure.protocolRemove(PROTOCOL_X)).to.be.revertedWith(
        "DEBT"
      );
    });
    it("Remove fail, poolManager did not remove", async function () {
      blockNumberEnd = await blockNumber(
        insure.setProtocolPremiums(PROTOCOL_X, [tokenA.address], [0])
      );
      await expect(insure.protocolRemove(PROTOCOL_X)).to.be.revertedWith(
        "NOT_PROTOCOL"
      );
    });
    it("Remove success", async function () {
      expect(await tokenA.balanceOf(alice.address)).to.eq(0);
      await insure.removeProtocol(
        PROTOCOL_X,
        0,
        true,
        alice.address,
        tokenA.address
      );
      await insure.protocolRemove(PROTOCOL_X);

      const pPaid = blockNumberEnd.sub(blockNumberStart).mul(parseEther("1"));
      expect(await tokenA.balanceOf(alice.address)).to.eq(
        parseEther("100").sub(pPaid)
      );
      expect(await insure.getProtocolIsCovered(PROTOCOL_X)).to.eq(false);
      expect(await insure.getProtocolManager(PROTOCOL_X)).to.eq(
        constants.AddressZero
      );
      expect(await insure.getProtocolAgent(PROTOCOL_X)).to.eq(
        constants.AddressZero
      );
    });
  });
  describe("tokenAdd()", function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it("Add", async function () {
      await insure.tokenAdd(tokenA.address, stakeA.address, owner.address);

      tokens = await insure.getTokens();
      expect(tokens.length).to.eq(1);
      expect(tokens[0]).to.eq(tokenA.address);

      expect(await insure.isInitialized(tokenA.address)).to.eq(true);
      expect(await insure.isDeposit(tokenA.address)).to.eq(true);
      expect(await insure.getGovPool(tokenA.address)).to.eq(owner.address);
      expect(await insure.getStakeToken(tokenA.address)).to.eq(stakeA.address);
    });
  });
  describe("tokenDisable()", function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await insure.tokenAdd(tokenA.address, stakeA.address, owner.address);
    });
    it("Disable", async function () {
      await insure.tokenDisable(tokenA.address);

      tokens = await insure.getTokens();
      expect(tokens.length).to.eq(1);
      expect(tokens[0]).to.eq(tokenA.address);

      expect(await insure.isInitialized(tokenA.address)).to.eq(true);
      expect(await insure.isDeposit(tokenA.address)).to.eq(false);
      expect(await insure.getGovPool(tokenA.address)).to.eq(owner.address);
      expect(await insure.getStakeToken(tokenA.address)).to.eq(stakeA.address);
    });
  });
  describe("tokenRemove()", function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await insure.tokenAdd(tokenA.address, stakeA.address, owner.address);
      await insure.tokenDisable(tokenA.address);
    });
    it("Remove", async function () {
      await insure.tokenRemove(tokenA.address, 0, alice.address);

      tokens = await insure.getTokens();
      expect(tokens.length).to.eq(0);

      await expect(insure.isInitialized(tokenA.address)).to.be.revertedWith(
        "INVALID_TOKEN"
      );
    });
  });
});
