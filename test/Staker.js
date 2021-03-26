const { expect } = require("chai");
const { utils } = require("ethers/lib");
const { parseEther, parseUnits } = require("ethers/lib/utils");
const { constants } = require("ethers");
const { insurance, erc20, tvl } = require("./utils.js");
const { TimeTraveler } = require("./utils-snapshot.js");

const PROTOCOL_X =
  "0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7";

describe.only("Staker tests", function () {
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
    await tokenA.transfer(alice.address, parseEther("100"));
    await tokenA.approve(insure.address, constants.MaxUint256);
    await tokenA.connect(alice).approve(insure.address, constants.MaxUint256);

    const Stake = await ethers.getContractFactory("Stake");
    [stakeA, stakeB, stakeC] = [
      await Stake.deploy("Stake TokenA", "stkA"),
      await Stake.deploy("Stake TokenB", "stkB"),
      await Stake.deploy("Stake TokenC", "stkC"),
    ];
    await stakeA.approve(insure.address, constants.MaxUint256);
    await stakeA.transferOwnership(insure.address);
    await stakeB.transferOwnership(insure.address);
    await stakeC.transferOwnership(insure.address);

    await insure.tokenAdd(tokenA.address, stakeA.address, owner.address);
    await insure.tokenAdd(tokenB.address, stakeB.address, owner.address);
    await insure.protocolAdd(PROTOCOL_X, owner.address, owner.address);

    await timeTraveler.snapshot();
  });
  it("Initial state", async function () {
    await erc20(tokenA, {
      [owner.address]: "900",
      [alice.address]: "100",
      [insure.address]: "0",
      total: "1000",
    });
    await erc20(stakeA, {
      [owner.address]: "0",
      [alice.address]: "0",
      [insure.address]: "0",
      total: "0",
    });
    await tvl(tokenA, {
      [owner.address]: "0",
      [alice.address]: "0",
      [insure.address]: "0",
      total: "0",
    });
  });
  describe("stake(), example 1", function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it("Owner stake 10", async function () {
      expect(
        await insure.stake(parseEther("10"), owner.address, tokenA.address)
      );

      await erc20(tokenA, {
        [owner.address]: "890",
        [alice.address]: "100",
        [insure.address]: "10",
        total: "1000",
      });
      await erc20(stakeA, {
        [owner.address]: "1",
        [alice.address]: "0",
        [insure.address]: "0",
        total: "1",
      });
      await tvl(tokenA, {
        [owner.address]: "10",
        [alice.address]: "0",
        [insure.address]: "0",
        total: "10",
      });
    });
    it("Owner stake 20 for Alice", async function () {
      expect(
        await insure.stake(parseEther("20"), alice.address, tokenA.address)
      );

      await erc20(tokenA, {
        [owner.address]: "870",
        [alice.address]: "100",
        [insure.address]: "30",
        total: "1000",
      });
      await erc20(stakeA, {
        [owner.address]: "1",
        [alice.address]: "2",
        [insure.address]: "0",
        total: "3",
      });
      await tvl(tokenA, {
        [owner.address]: "10",
        [alice.address]: "20",
        [insure.address]: "0",
        total: "30",
      });
    });
    it("Owner stake 10 again", async function () {
      expect(
        await insure.stake(parseEther("10"), owner.address, tokenA.address)
      );

      await erc20(tokenA, {
        [owner.address]: "860",
        [alice.address]: "100",
        [insure.address]: "40",
        total: "1000",
      });
      await erc20(stakeA, {
        [owner.address]: "2",
        [alice.address]: "2",
        [insure.address]: "0",
        total: "4",
      });
      await tvl(tokenA, {
        [owner.address]: "20",
        [alice.address]: "20",
        [insure.address]: "0",
        total: "40",
      });
    });
    it("Alice stake 40", async function () {
      expect(
        await insure
          .connect(alice)
          .stake(parseEther("40"), alice.address, tokenA.address)
      );

      await erc20(tokenA, {
        [owner.address]: "860",
        [alice.address]: "60",
        [insure.address]: "80",
        total: "1000",
      });
      await erc20(stakeA, {
        [owner.address]: "2",
        [alice.address]: "6",
        [insure.address]: "0",
        total: "8",
      });
      await tvl(tokenA, {
        [owner.address]: "20",
        [alice.address]: "60",
        [insure.address]: "0",
        total: "80",
      });
    });
  });
  describe("stake(), example 2", function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it("Owner stake 100", async function () {
      expect(
        await insure.stake(parseEther("100"), owner.address, tokenA.address)
      );

      await erc20(tokenA, {
        [owner.address]: "800",
        [alice.address]: "100",
        [insure.address]: "100",
        total: "1000",
      });
      await erc20(stakeA, {
        [owner.address]: "1",
        [alice.address]: "0",
        [insure.address]: "0",
        total: "1",
      });
      await tvl(tokenA, {
        [owner.address]: "100",
        [alice.address]: "0",
        [insure.address]: "0",
        total: "100",
      });
    });
    it("Owner stake 200 for Alice", async function () {
      expect(
        await insure.stake(parseEther("200"), alice.address, tokenA.address)
      );

      await erc20(tokenA, {
        [owner.address]: "600",
        [alice.address]: "100",
        [insure.address]: "300",
        total: "1000",
      });
      await erc20(stakeA, {
        [owner.address]: "1",
        [alice.address]: "2",
        [insure.address]: "0",
        total: "3",
      });
      await tvl(tokenA, {
        [owner.address]: "100",
        [alice.address]: "200",
        [insure.address]: "0",
        total: "300",
      });
    });
  });
});
