const { expect } = require("chai");
const { utils } = require("ethers/lib");
const { parseEther, parseUnits } = require("ethers/lib/utils");
const { constants } = require("ethers");
const { insurance, erc20, tvl, blockNumber, mine } = require("./utils.js");
const { TimeTraveler } = require("./utils-snapshot.js");

const PROTOCOL_X =
  "0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7";

describe("Protocol tests", function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);

    [owner, alice] = await ethers.getSigners();
    [owner.address, alice.address] = [
      await owner.getAddress(),
      await alice.getAddress(),
    ];

    insure = await insurance(owner.address);
    await insure.setInitialGovInsurance(owner.address);

    const Token = await ethers.getContractFactory("MockToken");
    [tokenA, tokenB, tokenC] = [
      await Token.deploy("TokenA", "A", parseEther("1000")),
      await Token.deploy("TokenB", "B", parseEther("1000")),
      await Token.deploy("TokenC", "C", parseEther("1000")),
    ];
    await tokenA.approve(insure.address, constants.MaxUint256);
    await tokenA.connect(alice).approve(insure.address, constants.MaxUint256);

    const Stake = await ethers.getContractFactory("Stake");
    [stakeA, stakeB, stakeC] = [
      await Stake.deploy("Stake TokenA", "stkA", tokenA.address),
      await Stake.deploy("Stake TokenB", "stkB", tokenB.address),
      await Stake.deploy("Stake TokenC", "stkC", tokenC.address),
    ];
    await stakeA.approve(insure.address, constants.MaxUint256);
    await stakeA.transferOwnership(insure.address);
    await stakeB.transferOwnership(insure.address);
    await stakeC.transferOwnership(insure.address);

    await insure.tokenAdd(tokenA.address, stakeA.address, owner.address);
    await insure.protocolAdd(PROTOCOL_X, owner.address, owner.address);

    await timeTraveler.snapshot();
  });
  it("Initial state", async function () {
    expect(await tokenA.balanceOf(insure.address)).to.eq(parseEther("0"));
    expect(await tokenA.balanceOf(alice.address)).to.eq(parseEther("0"));
    expect(await insure.isProtocol(PROTOCOL_X, tokenA.address)).to.eq(false);
    const protocols = await insure.getProtocols(tokenA.address);
    expect(protocols.length).to.eq(0);
    expect(await insure.getProtocolBalance(PROTOCOL_X, tokenA.address)).to.eq(
      0
    );
  });
  describe("depositProtocolBalance()", function () {
    beforeEach(async function () {
      await timeTraveler.revertSnapshot();
    });
    it("Token disabled", async function () {
      await insure.tokenDisable(tokenA.address);
      await expect(
        insure.depositProtocolBalance(
          PROTOCOL_X,
          parseEther("1"),
          tokenA.address
        )
      ).to.be.revertedWith("NO_DEPOSITS");
    });
    it("Deposit", async function () {
      await insure.depositProtocolBalance(
        PROTOCOL_X,
        parseEther("1"),
        tokenA.address
      );

      expect(await tokenA.balanceOf(insure.address)).to.eq(parseEther("1"));
      expect(await insure.isProtocol(PROTOCOL_X, tokenA.address)).to.eq(true);
      const protocols = await insure.getProtocols(tokenA.address);
      expect(protocols.length).to.eq(1);
      expect(protocols[0]).to.eq(PROTOCOL_X);
      expect(await insure.getProtocolBalance(PROTOCOL_X, tokenA.address)).to.eq(
        parseEther("1")
      );
    });
    it("Deposit twice", async function () {
      await insure.depositProtocolBalance(
        PROTOCOL_X,
        parseEther("1"),
        tokenA.address
      );
      await insure.depositProtocolBalance(
        PROTOCOL_X,
        parseEther("1"),
        tokenA.address
      );

      expect(await tokenA.balanceOf(insure.address)).to.eq(parseEther("2"));
      expect(await insure.isProtocol(PROTOCOL_X, tokenA.address)).to.eq(true);
      const protocols = await insure.getProtocols(tokenA.address);
      expect(protocols.length).to.eq(1);
      expect(protocols[0]).to.eq(PROTOCOL_X);
      expect(await insure.getProtocolBalance(PROTOCOL_X, tokenA.address)).to.eq(
        parseEther("2")
      );
    });
  });
  describe("withdrawProtocolBalance()", function () {
    beforeEach(async function () {
      await timeTraveler.revertSnapshot();
      await insure.depositProtocolBalance(
        PROTOCOL_X,
        parseEther("100"),
        tokenA.address
      );
      startBlock = await blockNumber(
        insure.setProtocolPremiums(
          PROTOCOL_X,
          [tokenA.address],
          [parseEther("5")],
          [parseEther("1")]
        )
      );
    });
    it("Withdraw too much", async function () {
      await expect(
        insure.withdrawProtocolBalance(
          PROTOCOL_X,
          parseEther("96"),
          alice.address,
          tokenA.address
        )
      ).to.be.revertedWith("revert SafeMath: subtraction overflow");
    });
    it("Withdraw all", async function () {
      endBlock = await blockNumber(
        insure.withdrawProtocolBalance(
          PROTOCOL_X,
          constants.MaxUint256,
          alice.address,
          tokenA.address
        )
      );
      const debt = endBlock.sub(startBlock).mul(parseEther("5"));

      expect(debt).to.eq(parseEther("5"));
      expect(await tokenA.balanceOf(insure.address)).to.eq(parseEther("5"));
      expect(await tokenA.balanceOf(alice.address)).to.eq(parseEther("95"));
      expect(await insure.isProtocol(PROTOCOL_X, tokenA.address)).to.eq(true);
      const protocols = await insure.getProtocols(tokenA.address);
      expect(protocols.length).to.eq(1);
      expect(protocols[0]).to.eq(PROTOCOL_X);
      expect(await insure.getProtocolBalance(PROTOCOL_X, tokenA.address)).to.eq(
        0
      );
    });
    it("Withdraw some", async function () {
      endBlock = await blockNumber(
        insure.withdrawProtocolBalance(
          PROTOCOL_X,
          parseEther("50"),
          alice.address,
          tokenA.address
        )
      );
      const debt = endBlock.sub(startBlock).mul(parseEther("5"));

      expect(debt).to.eq(parseEther("5"));
      expect(await tokenA.balanceOf(insure.address)).to.eq(parseEther("50"));
      expect(await tokenA.balanceOf(alice.address)).to.eq(parseEther("50"));
      expect(await insure.isProtocol(PROTOCOL_X, tokenA.address)).to.eq(true);
      const protocols = await insure.getProtocols(tokenA.address);
      expect(protocols.length).to.eq(1);
      expect(protocols[0]).to.eq(PROTOCOL_X);
      expect(await insure.getProtocolBalance(PROTOCOL_X, tokenA.address)).to.eq(
        parseEther("45")
      );
    });
  });
});
