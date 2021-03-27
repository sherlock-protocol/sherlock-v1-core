const { expect } = require("chai");
const { utils } = require("ethers/lib");
const { parseEther, parseUnits } = require("ethers/lib/utils");
const { constants } = require("ethers");
const { insurance, erc20, tvl, blockNumber } = require("./utils.js");
const { TimeTraveler } = require("./utils-snapshot.js");

const PROTOCOL_X =
  "0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7";

const onePercent = ethers.BigNumber.from("10").pow(16);

describe("Staker tests", function () {
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
    await expect(insure.exchangeRate(tokenA.address)).to.be.revertedWith(
      "N0_STAKE"
    );
    expect(await insure.getFirstMoneyOut(tokenA.address)).to.eq(0);
  });
  describe("stake(), scenario 1", function () {
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

      expect(await insure.exchangeRate(tokenA.address)).to.eq(
        parseEther("0.1")
      );
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

      expect(await insure.exchangeRate(tokenA.address)).to.eq(
        parseEther("0.1")
      );
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

      expect(await insure.exchangeRate(tokenA.address)).to.eq(
        parseEther("0.1")
      );
      expect(await insure.getFirstMoneyOut(tokenA.address)).to.eq(0);
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

      expect(await insure.exchangeRate(tokenA.address)).to.eq(
        parseEther("0.1")
      );
    });
  });
  describe("stake(), scenario 2", function () {
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

      expect(await insure.exchangeRate(tokenA.address)).to.eq(
        parseEther("0.01")
      );
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

      expect(await insure.exchangeRate(tokenA.address)).to.eq(
        parseEther("0.01")
      );
    });
  });
  describe("withdrawStake(), no fee", function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      expect(
        await insure.stake(parseEther("10"), owner.address, tokenA.address)
      );
    });
    it("Initial state", async function () {
      expect(
        await insure.getWithdrawalSize(owner.address, tokenA.address)
      ).to.eq(0);
      expect(
        await insure.getWithrawalInitialIndex(owner.address, tokenA.address)
      ).to.eq(0);
      expect(await insure.getExitFee()).to.eq(0);
    });
    it("Withdraw too much stake", async function () {
      await expect(
        insure.withdrawStake(parseEther("1.1"), tokenA.address)
      ).to.be.revertedWith("revert ERC20: transfer amount exceeds balance");
    });
    it("Withdraw 0.5 stake", async function () {
      const blocknumber = await blockNumber(
        insure.withdrawStake(parseEther("0.5"), tokenA.address)
      );
      expect(
        await insure.getWithdrawalSize(owner.address, tokenA.address)
      ).to.eq(1);
      expect(
        await insure.getWithrawalInitialIndex(owner.address, tokenA.address)
      ).to.eq(0);
      [block, amount] = await insure.getWithdrawal(
        owner.address,
        0,
        tokenA.address
      );
      expect(block).to.eq(blocknumber);
      expect(amount).to.eq(parseEther("0.5"));
    });
    it("Finishing state", async function () {
      await erc20(tokenA, {
        [owner.address]: "890",
        [alice.address]: "100",
        [insure.address]: "10",
        total: "1000",
      });
      await erc20(stakeA, {
        [owner.address]: "0.5",
        [alice.address]: "0",
        [insure.address]: "0.5",
        total: "1",
      });
      await tvl(tokenA, {
        [owner.address]: "5",
        [alice.address]: "0",
        [insure.address]: "5",
        total: "10",
      });
      expect(await insure.exchangeRate(tokenA.address)).to.eq(
        parseEther("0.1")
      );
      expect(await insure.getFirstMoneyOut(tokenA.address)).to.eq(0);
    });
  });
  describe("withdrawStake(), 40% fee", function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await insure.setExitFee(onePercent.mul(40));
      expect(
        await insure.stake(parseEther("10"), owner.address, tokenA.address)
      );
    });
    it("Initial state", async function () {
      expect(
        await insure.getWithdrawalSize(owner.address, tokenA.address)
      ).to.eq(0);
      expect(
        await insure.getWithrawalInitialIndex(owner.address, tokenA.address)
      ).to.eq(0);
      expect(await insure.getExitFee()).to.eq(onePercent.mul(40));

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
      expect(await insure.getFirstMoneyOut(tokenA.address)).to.eq(0);
    });
    it("Withdraw 0.5 stake", async function () {
      const blocknumber = await blockNumber(
        insure.withdrawStake(parseEther("0.5"), tokenA.address)
      );
      expect(
        await insure.getWithdrawalSize(owner.address, tokenA.address)
      ).to.eq(1);
      expect(
        await insure.getWithrawalInitialIndex(owner.address, tokenA.address)
      ).to.eq(0);
      [block, amount] = await insure.getWithdrawal(
        owner.address,
        0,
        tokenA.address
      );
      expect(block).to.eq(blocknumber);
      expect(amount).to.eq(parseEther("0.30"));
    });
    it("Finishing state", async function () {
      await erc20(tokenA, {
        [owner.address]: "890",
        [alice.address]: "100",
        [insure.address]: "10",
        total: "1000",
      });
      await erc20(stakeA, {
        [owner.address]: "0.5",
        [alice.address]: "0",
        [insure.address]: "0.3",
        total: "0.8",
      });
      await tvl(tokenA, {
        [owner.address]: "5",
        [alice.address]: "0",
        [insure.address]: "3",
        total: "8",
      });
      expect(await insure.exchangeRate(tokenA.address)).to.eq(
        parseEther("0.1")
      );
      expect(await insure.getFirstMoneyOut(tokenA.address)).to.eq(
        parseEther("2")
      );
    });
  });
  describe("withdrawCancel()", function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      expect(
        await insure.stake(parseEther("10"), owner.address, tokenA.address)
      );
      // withdraw
    });
  });
  describe("withdrawPurge()", function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      expect(
        await insure.stake(parseEther("10"), owner.address, tokenA.address)
      );
      // withdraw + skip time
    });
  });
  describe("withdrawClaim()", function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      expect(
        await insure.stake(parseEther("10"), owner.address, tokenA.address)
      );
      await insure.withdrawStake(parseEther("0.5"), tokenA.address);
      // withdraw + skip some time
    });
  });
});
