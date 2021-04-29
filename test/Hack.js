const { expect } = require("chai");
const { utils } = require("ethers/lib");
const {
  parseEther,
  parseUnits,
  parseTransaction,
} = require("ethers/lib/utils");
const { constants } = require("ethers");
const { insurance, erc20, tvl, blockNumber, mine } = require("./utils.js");
const { TimeTraveler } = require("./utils-snapshot.js");

const PROTOCOL_X =
  "0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7";

const hundredPercent = ethers.BigNumber.from("10").pow(18);
let timeTraveler;

describe("Hack tests", function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);

    [owner, alice, bob, carol] = await ethers.getSigners();
    [owner.address, alice.address, bob.address, carol.address] = [
      await owner.getAddress(),
      await alice.getAddress(),
      await bob.getAddress(),
      await carol.getAddress(),
    ];

    insure = await insurance(owner.address);
    await insure.setInitialGovInsurance(owner.address);

    const Token = await ethers.getContractFactory("MockToken");
    [tokenA, tokenB, tokenC] = [
      await Token.deploy("TokenA", "A", parseEther("300020")),
      await Token.deploy("TokenB", "B", parseEther("1000000")),
      await Token.deploy("TokenC", "C", parseEther("1000000")),
    ];

    const MockUNI = await ethers.getContractFactory("MockUNI");
    mockUNI = await MockUNI.deploy();
    await tokenA.transfer(mockUNI.address, parseEther("100000"));

    //await tokenA.transfer(carol.address, parseEther("10"));
    await tokenA.approve(insure.address, constants.MaxUint256);
    await tokenB.approve(insure.address, constants.MaxUint256);
    await tokenA.connect(alice).approve(insure.address, constants.MaxUint256);
    await tokenA.connect(carol).approve(insure.address, constants.MaxUint256);

    const Stake = await ethers.getContractFactory("StakePlus");
    const StakeFee = await ethers.getContractFactory("Stake");
    [stakeA, stakeB, stakeC] = [
      await Stake.deploy("Stake TokenA", "stkA", tokenA.address),
      await Stake.deploy("Stake TokenB", "stkB", tokenB.address),
      await Stake.deploy("Stake TokenC", "stkC", tokenC.address),
    ];

    stakeFee = await StakeFee.deploy("Stake Fee", "stkFEE");
    await stakeFee.transferOwnership(insure.address);
    //await stakeFee.approve(insure.address, constants.MaxUint256);
    await stakeFee.connect(alice).approve(insure.address, constants.MaxUint256);
    await stakeFee.connect(carol).approve(insure.address, constants.MaxUint256);

    await stakeA.approve(insure.address, constants.MaxUint256);
    await stakeA.connect(carol).approve(insure.address, constants.MaxUint256);
    await stakeB.approve(insure.address, constants.MaxUint256);
    await stakeA.transferOwnership(insure.address);
    await stakeB.transferOwnership(insure.address);
    await stakeC.transferOwnership(insure.address);

    await insure.tokenAdd(tokenA.address, stakeA.address, owner.address);
    await insure.tokenAdd(tokenB.address, stakeB.address, owner.address);
    await insure.tokenAdd(insure.address, stakeFee.address, owner.address);
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

    await insure.setClaimPeriod(2);
    await insure.setWeights([tokenA.address], [parseEther("1")]);

    await timeTraveler.snapshot();
  });
  describe("Payout", function () {
    beforeEach(async function () {
      await timeTraveler.revertSnapshot();
      const ApremiumPerBlock = parseEther("1000");
      const AusdPerPremium = parseEther("1");

      const BpremiumPerBlock = parseEther("5");
      const BusdPerPremium = parseEther("200");

      await insure.setProtocolPremiums(
        PROTOCOL_X,
        [tokenA.address, tokenB.address],
        [ApremiumPerBlock, BpremiumPerBlock],
        [AusdPerPremium, BusdPerPremium]
      );
    });
    it("Non hack", async function () {
      await insure.stake(parseEther("10"), owner.address, tokenA.address);

      await mine(9);

      const fee = await insure.getWithdrawableFeeAmount(
        owner.address,
        tokenA.address
      );
      await expect(fee).to.eq(parseEther("10"));
      await expect(await stakeA.balanceOf(owner.address)).to.eq(
        parseEther("1")
      );
      await expect(await insure.exchangeRate(tokenA.address)).to.eq(
        parseEther("10")
      );
    });
    it("Yes hack, unmaterialized fee", async function () {
      await insure.stake(parseEther("10"), owner.address, tokenA.address);

      // one less block, as payout mines an extra block
      await mine(8);

      await insure.payout(
        alice.address,
        [tokenA.address],
        [0],
        [0],
        [parseEther("6")]
      );

      const fee = await insure.getWithdrawableFeeAmount(
        owner.address,
        tokenA.address
      );
      await expect(fee).to.eq(parseEther("4"));
      await expect(await stakeA.balanceOf(owner.address)).to.eq(
        parseEther("1")
      );
      await expect(await insure.exchangeRate(tokenA.address)).to.eq(
        parseEther("10")
      );
    });
    it("Yes hack, pool balance", async function () {
      await insure.stake(parseEther("10"), owner.address, tokenA.address);

      // one less block, as payout mines an extra block
      await mine(8);

      await insure.payout(
        alice.address,
        [tokenA.address],
        [0],
        [parseEther("6")],
        [0]
      );

      const fee = await insure.getWithdrawableFeeAmount(
        owner.address,
        tokenA.address
      );
      await expect(fee).to.eq(parseEther("10"));
      await expect(await stakeA.balanceOf(owner.address)).to.eq(
        parseEther("1")
      );
      await expect(await insure.exchangeRate(tokenA.address)).to.eq(
        parseEther("4")
      );
    });
    it("Yes hack, fmo", async function () {
      await insure.setExitFee(parseEther("0.5"), tokenA.address);

      await insure.stake(parseEther("20"), owner.address, tokenA.address);

      await mine(5);

      await insure.withdrawStake(parseEther("0.5"), tokenA.address);
      await insure.withdrawClaim(0, owner.address, tokenA.address);

      // 5/10 tokens go to fmo pool.

      await insure.payout(
        alice.address,
        [tokenA.address],
        [parseEther("5")],
        [0],
        [0]
      );

      const fee = await insure.getWithdrawableFeeAmount(
        owner.address,
        tokenA.address
      );

      // 0.33 because it is 1/3 of the current pool (0.25 stake)
      // As 0.25 is burned in withdrawStake as exit fee
      // So 1 FEE is divided among all stake (which is 0.75)
      // And pool holds 0.25 stake for 1 block
      await expect(await insure.getFirstMoneyOut(insure.address)).to.eq(
        parseEther("0.333333333333333333")
      );
      await expect(fee).to.eq(parseEther("1.666666666666666667"));
      // there is an active withdrawal of 1 stakeFee
      await expect(await insure.exchangeRate(insure.address)).to.eq(
        parseEther("8")
      );
      // Above fee sums up to 10

      await expect(await stakeA.balanceOf(owner.address)).to.eq(
        parseEther("0.5")
      );
      // 1 stake = 20 underlying as user staked 20 at the start.
      await expect(await insure.exchangeRate(tokenA.address)).to.eq(
        parseEther("20")
      );
    });
  });
});
