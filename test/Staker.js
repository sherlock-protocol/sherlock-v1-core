const { expect } = require("chai");
const { utils } = require("ethers/lib");
const { parseEther, parseUnits } = require("ethers/lib/utils");
const { constants } = require("ethers");
const { insurance, erc20, tvl, blockNumber, mine } = require("./utils.js");
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

    const Stake = await ethers.getContractFactory("ForeignLock");
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
  describe("stake(), disabled", function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it("Token disabled", async function () {
      await insure.tokenDisable(tokenA.address);
      await expect(
        insure.stake(parseEther("10"), owner.address, tokenA.address)
      ).to.be.revertedWith("NO_STAKES");
    });
  });
  describe("stake(), scenario 1", function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it("Owner stake 10", async function () {
      await insure.stake(parseEther("10"), owner.address, tokenA.address);

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

      expect(await insure.exchangeRate(tokenA.address)).to.eq(parseEther("10"));
    });
    it("Owner stake 20 for Alice", async function () {
      await insure.stake(parseEther("20"), alice.address, tokenA.address);

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

      expect(await insure.exchangeRate(tokenA.address)).to.eq(parseEther("10"));
    });
    it("Owner stake 10 again", async function () {
      await insure.stake(parseEther("10"), owner.address, tokenA.address);

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

      expect(await insure.exchangeRate(tokenA.address)).to.eq(parseEther("10"));
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

      expect(await insure.exchangeRate(tokenA.address)).to.eq(parseEther("10"));
    });
  });
  describe("stake(), scenario 2", function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it("Owner stake 100", async function () {
      await insure.stake(parseEther("100"), owner.address, tokenA.address);

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
        parseEther("100")
      );
    });
    it("Owner stake 200 for Alice", async function () {
      await insure.stake(parseEther("200"), alice.address, tokenA.address);

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
        parseEther("100")
      );
    });
  });
  describe("activateCooldown(), no fee", function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await insure.stake(parseEther("10"), owner.address, tokenA.address);
    });
    it("Initial state", async function () {
      expect(
        await insure.getUnstakeEntrySize(owner.address, tokenA.address)
      ).to.eq(0);
      expect(
        await insure.getInitialUnstakeEntry(owner.address, tokenA.address)
      ).to.eq(0);
      expect(await insure.getCooldownFee(tokenA.address)).to.eq(0);
    });
    it("Withdraw too much stake", async function () {
      await expect(insure.activateCooldown(parseEther("1.1"), tokenA.address))
        .to.be.reverted;
    });
    it("Withdraw 0.5 stake", async function () {
      const blocknumber = await blockNumber(
        insure.activateCooldown(parseEther("0.5"), tokenA.address)
      );
      expect(
        await insure.getUnstakeEntrySize(owner.address, tokenA.address)
      ).to.eq(1);
      expect(
        await insure.getInitialUnstakeEntry(owner.address, tokenA.address)
      ).to.eq(1); // immediately expired, as both periods are 0
      [block, amount] = await insure.getUnstakeEntry(
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
      expect(await insure.exchangeRate(tokenA.address)).to.eq(parseEther("10"));
      expect(await insure.getFirstMoneyOut(tokenA.address)).to.eq(0);
    });
  });
  describe("activateCooldown(), 40% fee", function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await insure.setCooldownFee(onePercent.mul(40), tokenA.address);
      await insure.stake(parseEther("10"), owner.address, tokenA.address);
    });
    it("Initial state", async function () {
      expect(
        await insure.getUnstakeEntrySize(owner.address, tokenA.address)
      ).to.eq(0);
      expect(
        await insure.getInitialUnstakeEntry(owner.address, tokenA.address)
      ).to.eq(0);
      expect(await insure.getCooldownFee(tokenA.address)).to.eq(
        onePercent.mul(40)
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
      expect(await insure.getFirstMoneyOut(tokenA.address)).to.eq(0);
    });
    it("Withdraw 0.5 stake", async function () {
      const blocknumber = await blockNumber(
        insure.activateCooldown(parseEther("0.5"), tokenA.address)
      );
      expect(
        await insure.getUnstakeEntrySize(owner.address, tokenA.address)
      ).to.eq(1);
      expect(
        await insure.getInitialUnstakeEntry(owner.address, tokenA.address)
      ).to.eq(1); // immediately expired, as both periods are 0
      [block, amount] = await insure.getUnstakeEntry(
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
      expect(await insure.exchangeRate(tokenA.address)).to.eq(parseEther("10"));
      expect(await insure.getFirstMoneyOut(tokenA.address)).to.eq(
        parseEther("2")
      );
    });
  });
  describe("cancelCooldown()", function () {
    beforeEach(async function () {
      await timeTraveler.revertSnapshot();

      await insure.stake(parseEther("10"), owner.address, tokenA.address);
      await insure.setCooldown(2);
      await insure.activateCooldown(parseEther("0.5"), tokenA.address);
      // withdraw
    });
    it("Not Expired, t=2", async function () {
      await mine(1);
      await insure.cancelCooldown(0, tokenA.address);
    });
    it("Expired, t=5", async function () {
      await mine(4);
      await expect(insure.cancelCooldown(0, tokenA.address)).to.be.revertedWith(
        "COOLDOWN_EXPIRED"
      );
    });
    it("Cancel twice", async function () {
      await insure.cancelCooldown(0, tokenA.address);
      await expect(insure.cancelCooldown(0, tokenA.address)).to.be.revertedWith(
        "WITHDRAW_NOT_ACTIVE"
      );
    });
    it("Cancel", async function () {
      await insure.cancelCooldown(0, tokenA.address);

      expect(
        await insure.getUnstakeEntrySize(owner.address, tokenA.address)
      ).to.eq(1);
      expect(
        await insure.getInitialUnstakeEntry(owner.address, tokenA.address)
      ).to.eq(1);
      [block, amount] = await insure.getUnstakeEntry(
        owner.address,
        0,
        tokenA.address
      );
      expect(block).to.eq(0);
      expect(amount).to.eq(0);

      // same state as on deposit
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
      expect(await insure.exchangeRate(tokenA.address)).to.eq(parseEther("10"));
      expect(await insure.getFirstMoneyOut(tokenA.address)).to.eq(0);
    });
  });
  describe("cancelCooldown(), with 20% fee", function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await insure.setCooldownFee(onePercent.mul(20), tokenA.address);
      await insure.stake(parseEther("10"), owner.address, tokenA.address);
      await insure.setCooldown(4);
      await insure.activateCooldown(parseEther("0.5"), tokenA.address);
      // withdraw
    });
    it("Cancel", async function () {
      await insure.cancelCooldown(0, tokenA.address);

      expect(
        await insure.getUnstakeEntrySize(owner.address, tokenA.address)
      ).to.eq(1);
      expect(
        await insure.getInitialUnstakeEntry(owner.address, tokenA.address)
      ).to.eq(1);
      [block, amount] = await insure.getUnstakeEntry(
        owner.address,
        0,
        tokenA.address
      );
      expect(block).to.eq(0);
      expect(amount).to.eq(0);

      // 1 token transferred to first money out pool
      await erc20(tokenA, {
        [owner.address]: "890",
        [alice.address]: "100",
        [insure.address]: "10",
        total: "1000",
      });
      await erc20(stakeA, {
        [owner.address]: "0.9",
        [alice.address]: "0",
        [insure.address]: "0",
        total: "0.9",
      });
      await tvl(tokenA, {
        [owner.address]: "9",
        [alice.address]: "0",
        [insure.address]: "0",
        total: "9",
      });
      expect(await insure.exchangeRate(tokenA.address)).to.eq(parseEther("10"));
      expect(await insure.getFirstMoneyOut(tokenA.address)).to.eq(
        parseEther("1")
      );
    });
  });
  describe("unstakeWindowExpiry()", function () {
    beforeEach(async function () {
      await timeTraveler.revertSnapshot();

      await insure.stake(parseEther("10"), owner.address, tokenA.address);
      await insure.setCooldown(2);
      await insure.setUnstakeWindow(3);
      await insure.activateCooldown(parseEther("0.5"), tokenA.address);
      // withdraw
    });
    it("Not expired, t=1", async function () {
      await expect(
        insure.unstakeWindowExpiry(owner.address, 0, tokenA.address)
      ).to.be.revertedWith("CLAIMPERIOD_NOT_EXPIRED");
    });
    it("Not expired, t=3", async function () {
      await mine(2);
      await expect(
        insure.unstakeWindowExpiry(owner.address, 0, tokenA.address)
      ).to.be.revertedWith("CLAIMPERIOD_NOT_EXPIRED");
    });
    it("Not expired, t=4", async function () {
      await mine(3);
      await expect(
        insure.unstakeWindowExpiry(owner.address, 0, tokenA.address)
      ).to.be.revertedWith("CLAIMPERIOD_NOT_EXPIRED");
    });
    it("Not expired, t=5", async function () {
      await mine(4);
      await expect(
        insure.unstakeWindowExpiry(owner.address, 0, tokenA.address)
      ).to.be.revertedWith("CLAIMPERIOD_NOT_EXPIRED");
    });
    it("Purge twice", async function () {
      await mine(5);
      await insure.unstakeWindowExpiry(owner.address, 0, tokenA.address);
      await expect(
        insure.unstakeWindowExpiry(owner.address, 0, tokenA.address)
      ).to.be.revertedWith("WITHDRAW_NOT_ACTIVE");
    });
    it("Purge success, t=6", async function () {
      await mine(5);
      await insure.unstakeWindowExpiry(owner.address, 0, tokenA.address);

      expect(
        await insure.getUnstakeEntrySize(owner.address, tokenA.address)
      ).to.eq(1);
      expect(
        await insure.getInitialUnstakeEntry(owner.address, tokenA.address)
      ).to.eq(1);
      [block, amount] = await insure.getUnstakeEntry(
        owner.address,
        0,
        tokenA.address
      );
      expect(block).to.eq(0);
      expect(amount).to.eq(0);

      // same state as on deposit
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
      expect(await insure.exchangeRate(tokenA.address)).to.eq(parseEther("10"));
      expect(await insure.getFirstMoneyOut(tokenA.address)).to.eq(0);
    });
  });
  describe("unstakeWindowExpiry(), 20% fee", function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await insure.setCooldownFee(onePercent.mul(20), tokenA.address);
      await insure.stake(parseEther("10"), owner.address, tokenA.address);
      await insure.activateCooldown(parseEther("0.5"), tokenA.address);
    });
    it("Purge", async function () {
      await insure.unstakeWindowExpiry(owner.address, 0, tokenA.address);

      expect(
        await insure.getUnstakeEntrySize(owner.address, tokenA.address)
      ).to.eq(1);
      expect(
        await insure.getInitialUnstakeEntry(owner.address, tokenA.address)
      ).to.eq(1);
      [block, amount] = await insure.getUnstakeEntry(
        owner.address,
        0,
        tokenA.address
      );
      expect(block).to.eq(0);
      expect(amount).to.eq(0);

      // 1 token transferred to first money out pool
      await erc20(tokenA, {
        [owner.address]: "890",
        [alice.address]: "100",
        [insure.address]: "10",
        total: "1000",
      });
      await erc20(stakeA, {
        [owner.address]: "0.9",
        [alice.address]: "0",
        [insure.address]: "0",
        total: "0.9",
      });
      await tvl(tokenA, {
        [owner.address]: "9",
        [alice.address]: "0",
        [insure.address]: "0",
        total: "9",
      });
      expect(await insure.exchangeRate(tokenA.address)).to.eq(parseEther("10"));
      expect(await insure.getFirstMoneyOut(tokenA.address)).to.eq(
        parseEther("1")
      );
    });
  });
  describe("unstake()", function () {
    beforeEach(async function () {
      await timeTraveler.revertSnapshot();

      await insure.stake(parseEther("10"), owner.address, tokenA.address);
      await insure.setCooldown(2);
      await insure.setUnstakeWindow(3);
      await insure.activateCooldown(parseEther("0.5"), tokenA.address);
      // withdraw + skip some time
    });
    it("Claim canceled", async function () {
      await insure.cancelCooldown(0, tokenA.address);
      await expect(
        insure.unstake(0, owner.address, tokenA.address)
      ).to.be.revertedWith("WITHDRAW_NOT_ACTIVE");
    });
    it("Cooldown, t=2", async function () {
      await mine(1);
      await expect(
        insure.unstake(0, owner.address, tokenA.address)
      ).to.be.revertedWith("COOLDOWN_ACTIVE");
    });
    it("Claimperiod, t=6", async function () {
      await mine(5);
      await expect(
        insure.unstake(0, owner.address, tokenA.address)
      ).to.be.revertedWith("CLAIMPERIOD_EXPIRED");
    });
    it("Claim twice", async function () {
      await mine(2);
      await insure.unstake(0, owner.address, tokenA.address);
      await expect(
        insure.unstake(0, owner.address, tokenA.address)
      ).to.be.revertedWith("WITHDRAW_NOT_ACTIVE");
    });
    it("Claim", async function () {
      // window of opportunity is 3 blocks (3,4,5)
      await mine(2);
      await insure.unstake(0, owner.address, tokenA.address);

      expect(
        await insure.getUnstakeEntrySize(owner.address, tokenA.address)
      ).to.eq(1);
      expect(
        await insure.getInitialUnstakeEntry(owner.address, tokenA.address)
      ).to.eq(1);
      [block, amount] = await insure.getUnstakeEntry(
        owner.address,
        0,
        tokenA.address
      );
      expect(block).to.eq(0);
      expect(amount).to.eq(0);

      // 1 token transferred to first money out pool
      await erc20(tokenA, {
        [owner.address]: "895",
        [alice.address]: "100",
        [insure.address]: "5",
        total: "1000",
      });
      await erc20(stakeA, {
        [owner.address]: "0.5",
        [alice.address]: "0",
        [insure.address]: "0",
        total: "0.5",
      });
      await tvl(tokenA, {
        [owner.address]: "5",
        [alice.address]: "0",
        [insure.address]: "0",
        total: "5",
      });
      expect(await insure.exchangeRate(tokenA.address)).to.eq(parseEther("10"));
      expect(await insure.getFirstMoneyOut(tokenA.address)).to.eq(0);
    });
  });
  describe("unstake(), 20% fee", function () {
    beforeEach(async function () {
      await timeTraveler.revertSnapshot();

      await insure.setCooldownFee(onePercent.mul(20), tokenA.address);
      await insure.stake(parseEther("10"), owner.address, tokenA.address);
      await insure.setCooldown(2);
      await insure.setUnstakeWindow(3);
      await insure.activateCooldown(parseEther("0.5"), tokenA.address);
      // withdraw + skip some time
    });
    it("Claim", async function () {
      // window of opportunity is 3 blocks (3,4,5)
      await mine(2);
      await insure.unstake(0, owner.address, tokenA.address);

      expect(
        await insure.getUnstakeEntrySize(owner.address, tokenA.address)
      ).to.eq(1);
      expect(
        await insure.getInitialUnstakeEntry(owner.address, tokenA.address)
      ).to.eq(1);
      [block, amount] = await insure.getUnstakeEntry(
        owner.address,
        0,
        tokenA.address
      );
      expect(block).to.eq(0);
      expect(amount).to.eq(0);

      // 1 token transferred to first money out pool
      await erc20(tokenA, {
        [owner.address]: "894",
        [alice.address]: "100",
        [insure.address]: "6",
        total: "1000",
      });
      await erc20(stakeA, {
        [owner.address]: "0.5",
        [alice.address]: "0",
        [insure.address]: "0",
        total: "0.5",
      });
      await tvl(tokenA, {
        [owner.address]: "5",
        [alice.address]: "0",
        [insure.address]: "0",
        total: "5",
      });
      expect(await insure.exchangeRate(tokenA.address)).to.eq(parseEther("10"));
      expect(await insure.getFirstMoneyOut(tokenA.address)).to.eq(
        parseEther("1")
      );
    });
  });
  describe("getInitialUnstakeEntry()", function () {
    beforeEach(async function () {
      await timeTraveler.revertSnapshot();

      await insure.setCooldownFee(onePercent.mul(20), tokenA.address);
      await insure.stake(parseEther("10"), owner.address, tokenA.address);
      await insure.setCooldown(2);
      await insure.setUnstakeWindow(3);
      await insure.activateCooldown(parseEther("0.5"), tokenA.address);
    });
    it("Initial", async function () {
      expect(
        await insure.getInitialUnstakeEntry(owner.address, tokenA.address)
      ).to.eq(0);
    });
    it("t=3", async function () {
      await mine(2);
      expect(
        await insure.getInitialUnstakeEntry(owner.address, tokenA.address)
      ).to.eq(0);
    });
    it("t=5", async function () {
      await mine(4);
      expect(
        await insure.getInitialUnstakeEntry(owner.address, tokenA.address)
      ).to.eq(0);
    });
    it("t=6", async function () {
      await mine(5);
      expect(
        await insure.getInitialUnstakeEntry(owner.address, tokenA.address)
      ).to.eq(1);
    });
    it("Multiple, single expired", async function () {
      await mine(5);
      await insure.activateCooldown(parseEther("0.5"), tokenA.address);
      expect(
        await insure.getInitialUnstakeEntry(owner.address, tokenA.address)
      ).to.eq(1);
    });
    it("Multiple, both expired", async function () {
      await insure.activateCooldown(parseEther("0.5"), tokenA.address);
      await mine(5);
      expect(
        await insure.getInitialUnstakeEntry(owner.address, tokenA.address)
      ).to.eq(2);
    });
    it("Multiple, single claimed", async function () {
      await mine(2);
      await insure.unstake(0, owner.address, tokenA.address);
      await insure.activateCooldown(parseEther("0.5"), tokenA.address);

      expect(
        await insure.getInitialUnstakeEntry(owner.address, tokenA.address)
      ).to.eq(1);
    });
    it("Multiple, cancel second", async function () {
      await insure.activateCooldown(parseEther("0.5"), tokenA.address);
      await insure.cancelCooldown(1, tokenA.address);

      expect(
        await insure.getInitialUnstakeEntry(owner.address, tokenA.address)
      ).to.eq(0);
    });
    it("Multiple, cancel first", async function () {
      await insure.activateCooldown(parseEther("0.5"), tokenA.address);
      await insure.cancelCooldown(0, tokenA.address);

      expect(
        await insure.getInitialUnstakeEntry(owner.address, tokenA.address)
      ).to.eq(1);
    });
    it("Multiple, claim second", async function () {
      await insure.activateCooldown(parseEther("0.5"), tokenA.address);
      await mine(2);
      await insure.unstake(1, owner.address, tokenA.address);

      expect(
        await insure.getInitialUnstakeEntry(owner.address, tokenA.address)
      ).to.eq(0);
    });
    it("Multiple, claim first", async function () {
      await insure.activateCooldown(parseEther("0.5"), tokenA.address);
      await mine(2);
      await insure.unstake(0, owner.address, tokenA.address);

      expect(
        await insure.getInitialUnstakeEntry(owner.address, tokenA.address)
      ).to.eq(1);
    });
  });
});
