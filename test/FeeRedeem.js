const { expect } = require("chai");
const { utils } = require("ethers/lib");
const { parseEther, parseUnits } = require("ethers/lib/utils");
const { constants } = require("ethers");
const { insurance, erc20, tvl, blockNumber, mine } = require("./utils.js");
const { TimeTraveler } = require("./utils-snapshot.js");

const PROTOCOL_X =
  "0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7";

const hundredPercent = ethers.BigNumber.from("10").pow(18);

describe("Fee tests", function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);

    [owner, alice, bob] = await ethers.getSigners();
    [owner.address, alice.address, bob.address] = [
      await owner.getAddress(),
      await alice.getAddress(),
      await bob.getAddress(),
    ];

    insure = await insurance(owner.address);
    await insure.setInitialGovInsurance(owner.address);

    const Token = await ethers.getContractFactory("MockToken");
    [tokenA, tokenB, tokenC] = [
      await Token.deploy("TokenA", "A", parseEther("1000000")),
      await Token.deploy("TokenB", "B", parseEther("1000000")),
      await Token.deploy("TokenC", "C", parseEther("1000000")),
    ];
    await tokenA.transfer(alice.address, parseEther("100"));
    await tokenA.transfer(bob.address, parseEther("100"));
    await tokenA.approve(insure.address, constants.MaxUint256);
    await tokenB.approve(insure.address, constants.MaxUint256);
    await tokenA.connect(alice).approve(insure.address, constants.MaxUint256);
    await tokenA.connect(bob).approve(insure.address, constants.MaxUint256);

    const Stake = await ethers.getContractFactory("Stake");
    [stakeA, stakeB, stakeC] = [
      await Stake.deploy("Stake TokenA", "stkA", tokenA.address),
      await Stake.deploy("Stake TokenB", "stkB", tokenB.address),
      await Stake.deploy("Stake TokenC", "stkC", tokenC.address),
    ];
    await stakeA.approve(insure.address, constants.MaxUint256);
    await stakeB.approve(insure.address, constants.MaxUint256);
    await stakeA.transferOwnership(insure.address);
    await stakeB.transferOwnership(insure.address);
    await stakeC.transferOwnership(insure.address);

    await insure.tokenAdd(tokenA.address, stakeA.address, owner.address);
    await insure.tokenAdd(tokenB.address, stakeB.address, owner.address);
    // await insure.tokenAdd(tokenB.address, stakeB.address, owner.address);
    await insure.protocolAdd(PROTOCOL_X, owner.address, owner.address);

    await insure.depositProtocolBalance(
      PROTOCOL_X,
      parseEther("200000"),
      tokenA.address
    );
    await insure.depositProtocolBalance(
      PROTOCOL_X,
      parseEther("200000"),
      tokenB.address
    );
    await timeTraveler.snapshot();
  });
  describe("stake(), multi", function () {
    beforeEach(async function () {
      await timeTraveler.revertSnapshot();
      //await insure.tokenAdd(tokenB.address, stakeB.address, owner.address);
    });
    it.only("Multis stale", async function () {
      // initial setup
      await insure.setWeights([tokenA.address], [parseEther("1")]);
      const ApremiumPerBlock = parseEther("1000");
      const AusdPerPremium = parseEther("1");

      const BpremiumPerBlock = parseEther("5");
      const BusdPerPremium = parseEther("200");

      // stake
      await insure.stake(parseEther("10"), owner.address, tokenA.address);
      await insure
        .connect(alice)
        .stake(parseEther("10"), alice.address, tokenA.address);

      await insure.setProtocolPremiums(
        PROTOCOL_X,
        [tokenA.address, tokenB.address],
        [ApremiumPerBlock, BpremiumPerBlock],
        [AusdPerPremium, BusdPerPremium]
      );

      await mine(23);
      // harvest
      await insure.harvestForMultipleMulti(
        [stakeA.address],
        [owner.address, alice.address],
        [stakeB.address]
      );
      await insure.claimAllForMulti([owner.address, alice.address]);

      expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("24"));
      expect(await insure.balanceOf(owner.address)).to.eq(parseEther("12"));
      expect(await insure.balanceOf(alice.address)).to.eq(parseEther("12"));

      await insure.redeem(parseEther("6"));

      expect(await insure.totalSupply()).to.eq(parseEther("18"));
      //expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("18"));
      expect(await insure.balanceOf(owner.address)).to.eq(parseEther("6"));
      expect(await insure.balanceOf(alice.address)).to.eq(parseEther("12"));
    });
  });
});
