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

describe("Stake swap tests", function () {
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
      await Token.deploy("TokenA", "A", parseEther("300010")),
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

    const Stake = await ethers.getContractFactory("ForeignStake");
    const StakeFee = await ethers.getContractFactory("NativeStake");
    [stakeA, stakeB, stakeC] = [
      await Stake.deploy("Stake TokenA", "stkA", tokenA.address),
      await Stake.deploy("Stake TokenB", "stkB", tokenB.address),
      await Stake.deploy("Stake TokenC", "stkC", tokenC.address),
    ];

    stakeFee = await StakeFee.deploy("Stake Fee", "stkFEE");
    await stakeFee.transferOwnership(insure.address);

    const SherlockSwap = await ethers.getContractFactory("SherlockSwap");
    sherlockSwap = await SherlockSwap.deploy(insure.address, stakeFee.address);
    await sherlockSwap.testSetRouter(mockUNI.address);
    await stakeFee.approve(sherlockSwap.address, constants.MaxUint256);
    await stakeFee
      .connect(alice)
      .approve(sherlockSwap.address, constants.MaxUint256);
    await stakeFee
      .connect(carol)
      .approve(sherlockSwap.address, constants.MaxUint256);

    await stakeA.approve(sherlockSwap.address, constants.MaxUint256);
    await stakeA
      .connect(carol)
      .approve(sherlockSwap.address, constants.MaxUint256);
    await stakeB.approve(sherlockSwap.address, constants.MaxUint256);
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

    const ApremiumPerBlock = parseEther("1000");
    const AusdPerPremium = parseEther("1");

    const BpremiumPerBlock = parseEther("5");
    const BusdPerPremium = parseEther("200");
    b0 = await blockNumber(
      insure.setProtocolPremiums(
        PROTOCOL_X,
        [tokenA.address, tokenB.address],
        [ApremiumPerBlock, BpremiumPerBlock],
        [AusdPerPremium, BusdPerPremium]
      )
    );
    await timeTraveler.snapshot();
  });
  describe("StakerSwap", function () {
    describe("1", function () {
      before(async function () {
        await timeTraveler.revertSnapshot();
        //await insure.tokenAdd(tokenB.address, stakeB.address, owner.address);
      });
      it("user depost, withdraw and claim (+fee swap)", async function () {
        // stake
        await insure.stake(parseEther("10"), owner.address, tokenA.address);

        await mine(9);
        // harvest
        await sherlockSwap.withdrawStake(parseEther("1"), stakeA.address);
        await sherlockSwap.withdrawClaimSwap(
          0,
          parseEther("2"),
          // FEE --> TokenA
          [insure.address, tokenA.address],
          1000
        );

        expect(await tokenA.balanceOf(owner.address)).to.eq(parseEther("13"));
        expect(await stakeA.balanceOf(owner.address)).to.eq(parseEther("0"));
        expect(await insure.balanceOf(owner.address)).to.eq(parseEther("0"));
        expect(await stakeFee.balanceOf(owner.address)).to.eq(parseEther("0"));

        expect(await insure.getFirstMoneyOut(insure.address)).to.eq(
          parseEther("1")
        );
      });
    });
    describe("2", function () {
      before(async function () {
        await timeTraveler.revertSnapshot();
        //await insure.tokenAdd(tokenB.address, stakeB.address, owner.address);
      });
      it("user depost, harvest, withdraw and claim (+fee swap)", async function () {
        // stake
        await insure.stake(parseEther("10"), owner.address, tokenA.address);
        await mine(4);

        await insure.harvest(stakeA.address);
        await mine(4);
        // harvest
        await sherlockSwap.withdrawStake(parseEther("1"), stakeA.address);
        await sherlockSwap.withdrawClaimSwap(
          0,
          parseEther("1"),
          // FEE --> TokenA
          [insure.address, tokenA.address],
          1000
        );

        expect(await tokenA.balanceOf(owner.address)).to.eq(parseEther("12"));
        expect(await stakeA.balanceOf(owner.address)).to.eq(parseEther("0"));
        expect(await insure.balanceOf(owner.address)).to.eq(parseEther("0"));
        expect(await stakeFee.balanceOf(owner.address)).to.eq(parseEther("0"));

        expect(await insure.getFirstMoneyOut(insure.address)).to.eq(
          parseEther("1")
        );
      });
    });
    describe("3", function () {
      before(async function () {
        await timeTraveler.revertSnapshot();
        //await insure.tokenAdd(tokenB.address, stakeB.address, owner.address);
      });
      it("exit fee, non harvest", async function () {
        await insure.setExitFee(hundredPercent.div(2), insure.address);
        // stake
        await insure.stake(parseEther("10"), owner.address, tokenA.address);

        await mine(9);
        // harvest
        const b1 = await blockNumber(
          await sherlockSwap.withdrawStake(parseEther("1"), stakeA.address)
        );

        const expectedFeeCut = b1.sub(b0).mul(parseEther("1")).div(2); // takes 50% of all fees withdrawn
        expect(await insure.getFirstMoneyOut(insure.address)).to.eq(
          expectedFeeCut
        );
        await sherlockSwap.withdrawClaimSwap(
          0,
          parseEther("2"),
          // FEE --> TokenA
          [insure.address, tokenA.address],
          1000
        );

        expect(await tokenA.balanceOf(owner.address)).to.eq(parseEther("13"));
        expect(await stakeA.balanceOf(owner.address)).to.eq(parseEther("0"));
        expect(await insure.balanceOf(owner.address)).to.eq(parseEther("0"));
        expect(await stakeFee.balanceOf(owner.address)).to.eq(parseEther("0"));

        expect(await insure.getFirstMoneyOut(insure.address)).to.eq(
          expectedFeeCut.add(parseEther("1"))
        );
      });
    });
    describe("4", function () {
      before(async function () {
        await timeTraveler.revertSnapshot();
        //await insure.tokenAdd(tokenB.address, stakeB.address, owner.address);
      });
      it("add exit fee", async function () {
        // 0
        // 12
        // 16

        // 0-12 --> deposited (fee is executed later stage)
        // 12-16 --> withdrawn
        await insure.setExitFee(hundredPercent.div(2), insure.address);

        // stake
        await insure.stake(parseEther("10"), owner.address, tokenA.address);
        await mine(4);

        const b1 = await blockNumber(insure.harvest(stakeA.address));
        await mine(4);
        // harvest

        const b2 = await blockNumber(
          sherlockSwap.withdrawStake(parseEther("1"), stakeA.address)
        );
        const expectedFeeCut = b2.sub(b0).mul(parseEther("1")).div(2); // takes 50% of all fees withdrawn
        expect(await insure.getFirstMoneyOut(insure.address)).to.eq(
          expectedFeeCut
        );
        await sherlockSwap.withdrawClaimSwap(
          0,
          parseEther("1"),
          // FEE --> TokenA
          [insure.address, tokenA.address],
          1000
        );

        expect(await tokenA.balanceOf(owner.address)).to.eq(parseEther("12"));
        expect(await stakeA.balanceOf(owner.address)).to.eq(parseEther("0"));
        expect(await insure.balanceOf(owner.address)).to.eq(parseEther("0"));
        expect(await stakeFee.balanceOf(owner.address)).to.eq(parseEther("0"));

        expect(await insure.getFirstMoneyOut(insure.address)).to.eq(
          expectedFeeCut.add(parseEther("1"))
        );
      });
    });
  });
});

describe("Stake swap tests, changing weights", function () {
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
      await Token.deploy("TokenA", "A", parseEther("300010")),
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

    const Stake = await ethers.getContractFactory("ForeignStake");
    const StakeFee = await ethers.getContractFactory("NativeStake");
    [stakeA, stakeB, stakeC] = [
      await Stake.deploy("Stake TokenA", "stkA", tokenA.address),
      await Stake.deploy("Stake TokenB", "stkB", tokenB.address),
      await Stake.deploy("Stake TokenC", "stkC", tokenC.address),
    ];

    stakeFee = await StakeFee.deploy("Stake Fee", "stkFEE");
    await stakeFee.transferOwnership(insure.address);

    const SherlockSwap = await ethers.getContractFactory("SherlockSwap");
    sherlockSwap = await SherlockSwap.deploy(insure.address, stakeFee.address);
    await sherlockSwap.testSetRouter(mockUNI.address);

    await stakeFee.approve(sherlockSwap.address, constants.MaxUint256);
    await stakeFee
      .connect(alice)
      .approve(sherlockSwap.address, constants.MaxUint256);
    await stakeFee
      .connect(carol)
      .approve(sherlockSwap.address, constants.MaxUint256);

    await stakeA.approve(sherlockSwap.address, constants.MaxUint256);
    await stakeA
      .connect(carol)
      .approve(sherlockSwap.address, constants.MaxUint256);
    await stakeB.approve(sherlockSwap.address, constants.MaxUint256);
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
    await insure.setWeights(
      [tokenA.address, insure.address],
      [parseEther("0.5"), parseEther("0.5")]
    );

    const ApremiumPerBlock = parseEther("1000");
    const AusdPerPremium = parseEther("1");

    const BpremiumPerBlock = parseEther("5");
    const BusdPerPremium = parseEther("200");
    b0 = await blockNumber(
      insure.setProtocolPremiums(
        PROTOCOL_X,
        [tokenA.address, tokenB.address],
        [ApremiumPerBlock, BpremiumPerBlock],
        [AusdPerPremium, BusdPerPremium]
      )
    );
    await timeTraveler.snapshot();
  });
  describe("StakerSwap", function () {
    describe("1", function () {
      before(async function () {
        await timeTraveler.revertSnapshot();
        //await insure.tokenAdd(tokenB.address, stakeB.address, owner.address);
      });
      it("user depost, withdraw and claim (+fee swap)", async function () {
        // stake
        await insure.stake(parseEther("10"), owner.address, tokenA.address);

        await mine(9);
        // harvest
        await sherlockSwap.withdrawStake(parseEther("1"), stakeA.address);
        await sherlockSwap.withdrawClaimSwap(
          0,
          parseEther("2"),
          // FEE --> TokenA
          [insure.address, tokenA.address],
          1000
        );

        expect(await tokenA.balanceOf(owner.address)).to.eq(parseEther("13"));
        expect(await stakeA.balanceOf(owner.address)).to.eq(parseEther("0"));
        expect(await insure.balanceOf(owner.address)).to.eq(parseEther("0"));
        expect(await stakeFee.balanceOf(owner.address)).to.eq(parseEther("0"));

        expect(await insure.getFirstMoneyOut(insure.address)).to.eq(
          parseEther("0.5")
        );
      });
    });
    describe("2", function () {
      before(async function () {
        await timeTraveler.revertSnapshot();
        //await insure.tokenAdd(tokenB.address, stakeB.address, owner.address);
      });
      it("user depost, harvest, withdraw and claim (+fee swap)", async function () {
        // stake
        await insure.stake(parseEther("10"), owner.address, tokenA.address);
        await mine(4);

        await insure.harvest(stakeA.address);
        await mine(4);
        // harvest
        await sherlockSwap.withdrawStake(parseEther("1"), stakeA.address);
        await sherlockSwap.withdrawClaimSwap(
          0,
          parseEther("1"),
          // FEE --> TokenA
          [insure.address, tokenA.address],
          1000
        );

        expect(await tokenA.balanceOf(owner.address)).to.eq(parseEther("12"));
        expect(await stakeA.balanceOf(owner.address)).to.eq(parseEther("0"));
        expect(await insure.balanceOf(owner.address)).to.eq(parseEther("0"));
        // 0 because all stake is withdrawed when using tool
        expect(await stakeFee.balanceOf(owner.address)).to.eq(parseEther("0"));

        expect(await insure.getFirstMoneyOut(insure.address)).to.eq(
          parseEther("0.5")
        );
      });
    });
    describe("3", function () {
      before(async function () {
        await timeTraveler.revertSnapshot();
        //await insure.tokenAdd(tokenB.address, stakeB.address, owner.address);
      });
      it("exit fee, non harvest", async function () {
        await insure.setExitFee(hundredPercent.div(2), insure.address);
        // stake
        await insure.stake(parseEther("10"), owner.address, tokenA.address);

        await mine(9);
        // harvest
        const b1 = await blockNumber(
          sherlockSwap.withdrawStake(parseEther("1"), stakeA.address)
        );

        const expectedFeeCut = b1.sub(b0).mul(parseEther("1")).div(2); // takes 50% of all fees withdrawn
        // still getting the full amount as the FEE is rewarded to FEE pool, which user is 100% owner of
        // user is only in there for 0 blocks, but still gets all the FEES
        // 50% of that total is taken as exit fee again
        expect(await insure.getFirstMoneyOut(insure.address)).to.eq(
          expectedFeeCut
        );

        await sherlockSwap.withdrawClaimSwap(
          0,
          parseEther("2"),
          // FEE --> TokenA
          [insure.address, tokenA.address],
          1000
        );

        expect(await tokenA.balanceOf(owner.address)).to.eq(parseEther("13"));
        expect(await stakeA.balanceOf(owner.address)).to.eq(parseEther("0"));
        expect(await insure.balanceOf(owner.address)).to.eq(parseEther("0"));
        expect(await stakeFee.balanceOf(owner.address)).to.eq(parseEther("0"));

        // The 0.5 earned FEE is distributed to the first money out pool
        // The other 0.5 FEE is distributed to the FEE pool. Nobody is in there.
        expect(await insure.getFirstMoneyOut(insure.address)).to.eq(
          expectedFeeCut.add(parseEther("1").div(2))
        );
      });
    });
    describe("4", function () {
      before(async function () {
        await timeTraveler.revertSnapshot();
        //await insure.tokenAdd(tokenB.address, stakeB.address, owner.address);
      });
      it("add exit fee", async function () {
        // 0
        // 12
        // 16

        // 0-12 --> deposited (fee is executed later stage)
        // 12-16 --> withdrawn
        await insure.setExitFee(hundredPercent.div(2), insure.address);
        // stake
        await insure.stake(parseEther("10"), owner.address, tokenA.address);
        await mine(4);

        const b1 = await blockNumber(insure.harvest(stakeA.address));
        await mine(4);
        // harvest

        const b2 = await blockNumber(
          sherlockSwap.withdrawStake(parseEther("1"), stakeA.address)
        );
        const expectedFeeCut = b2.sub(b0).mul(parseEther("1")).div(2); // takes 50% of all fees withdrawn
        // User does not get any extra fees as it is distributed to the stake fee pool
        expect(await insure.getFirstMoneyOut(insure.address)).to.eq(
          expectedFeeCut.sub(8)
        );
        await sherlockSwap.withdrawClaimSwap(
          0,
          parseEther("1"),
          // FEE --> TokenA
          [insure.address, tokenA.address],
          1000
        );

        expect(await tokenA.balanceOf(owner.address)).to.eq(parseEther("12"));
        expect(await stakeA.balanceOf(owner.address)).to.eq(parseEther("0"));
        expect(await insure.balanceOf(owner.address)).to.eq(parseEther("0"));
        expect(await stakeFee.balanceOf(owner.address)).to.eq(parseEther("0"));

        // The 0.5 earned FEE is distributed to the first money out pool
        // The other 0.5 FEE is distributed to the FEE pool.
        expect(await insure.getFirstMoneyOut(insure.address)).to.eq(
          expectedFeeCut.add(parseEther("1").div(2)).sub(8)
        );
      });
    });
    // TODO add fee on fee rewards, 50/50
    // should basically distribute 50% less FEE in both cases. (less fee in first money out)
  });
});
