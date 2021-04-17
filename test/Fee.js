const { expect } = require("chai");
const { utils } = require("ethers/lib");
const { parseEther, parseUnits } = require("ethers/lib/utils");
const { constants } = require("ethers");
const { insurance, erc20, tvl, blockNumber, mine } = require("./utils.js");
const { TimeTraveler } = require("./utils-snapshot.js");

const PROTOCOL_X =
  "0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7";

const hundredPercent = ethers.BigNumber.from("10").pow(18);

describe.only("Fee tests", function () {
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
    await tokenB.approve(insure.address, constants.MaxUint256);
    await tokenA.connect(alice).approve(insure.address, constants.MaxUint256);

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
    // await insure.tokenAdd(tokenB.address, stakeB.address, owner.address);
    await insure.protocolAdd(PROTOCOL_X, owner.address, owner.address);

    await timeTraveler.snapshot();
  });
  describe("stake(), single", function () {
    beforeEach(async function () {
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

      expect(await insure.exchangeRate(tokenA.address)).to.eq(
        parseEther("0.1")
      );
    });
    it("Scenario 1", async function () {
      // initial setup
      await insure.setWeights([tokenA.address], [parseEther("1")]);
      const premiumPerBlock = parseEther("1000");
      const usdPerPremium = parseEther("1");
      const t1 = await blockNumber(
        insure.setProtocolPremium(
          PROTOCOL_X,
          tokenA.address,
          premiumPerBlock,
          usdPerPremium
        )
      );

      // stake
      await insure.stake(parseEther("10"), owner.address, tokenA.address);
      expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("1"));
      expect(await insure.balanceOf(owner.address)).to.eq(0);

      await mine(3);

      // transfer
      await insure.harvest(stakeA.address);
      expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("5"));
      expect(await insure.balanceOf(owner.address)).to.eq(parseEther("5"));

      const t2 = await blockNumber(insure.payOffDebtAll(tokenA.address));
      const underlying = await insure.calcUnderyling();
      const underlyingUSD = await insure.calcUnderylingInStoredUSD();
      expect(t2.sub(t1).mul(premiumPerBlock)).to.eq(underlying.amounts[0]);
      expect(
        t2.sub(t1).mul(premiumPerBlock).mul(usdPerPremium).div(hundredPercent)
      ).to.eq(underlyingUSD);
    });
    it("Scenario stale", async function () {
      // initial setup
      await insure.setWeights([tokenA.address], [parseEther("1")]);
      const premiumPerBlock = parseEther("1000");
      const usdPerPremium = parseEther("1");
      await insure.setProtocolPremium(
        PROTOCOL_X,
        tokenA.address,
        premiumPerBlock,
        usdPerPremium
      );

      // stake
      await insure.stake(parseEther("10"), owner.address, tokenA.address);
      await insure
        .connect(alice)
        .stake(parseEther("10"), alice.address, tokenA.address);

      expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("2"));
      expect(await insure.balanceOf(owner.address)).to.eq(0);
      expect(await insure.balanceOf(alice.address)).to.eq(0);

      await mine(2);

      // harvest
      await insure.harvestForMultiple(stakeA.address, [
        owner.address,
        alice.address,
      ]);
      //await insure.payOffDebtAll(tokenA.address);
      // there was already 2 in the pool, this get distributed to owner, the other 3 get divided.
      expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("5"));
      expect(await insure.balanceOf(owner.address)).to.eq(parseEther("3.5"));
      expect(await insure.balanceOf(alice.address)).to.eq(parseEther("1.5"));

      expect(await insure.calcUnderylingInStoredUSD()).to.eq(
        parseEther("3500")
      );
      expect((await insure.calcUnderyling()).amounts[0]).to.eq(
        parseEther("3500")
      );

      expect(await insure.connect(alice).calcUnderylingInStoredUSD()).to.eq(
        parseEther("1500")
      );
      expect((await insure.connect(alice).calcUnderyling()).amounts[0]).to.eq(
        parseEther("1500")
      );

      await insure.setProtocolPremium(
        PROTOCOL_X,
        tokenA.address,
        premiumPerBlock,
        usdPerPremium
      );

      await mine(5);

      // harvest
      await insure.harvestForMultiple(stakeA.address, [
        owner.address,
        alice.address,
      ]);

      expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("12"));
      expect(await insure.balanceOf(owner.address)).to.eq(parseEther("7"));
      expect(await insure.balanceOf(alice.address)).to.eq(parseEther("5"));

      expect(await insure.calcUnderylingInStoredUSD()).to.eq(
        parseEther("7000")
      );
      expect((await insure.calcUnderyling()).amounts[0]).to.eq(
        parseEther("7000")
      );

      expect(await insure.connect(alice).calcUnderylingInStoredUSD()).to.eq(
        parseEther("5000")
      );
      expect((await insure.connect(alice).calcUnderyling()).amounts[0]).to.eq(
        parseEther("5000")
      );
    });
    it("Scenario stale, join later", async function () {
      // initial setup
      await insure.setWeights([tokenA.address], [parseEther("1")]);
      const premiumPerBlock = parseEther("1000");
      const usdPerPremium = parseEther("1");
      await insure.setProtocolPremium(
        PROTOCOL_X,
        tokenA.address,
        premiumPerBlock,
        usdPerPremium
      );

      // stake
      await insure.stake(parseEther("10"), owner.address, tokenA.address);

      expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("1"));
      expect(await insure.balanceOf(owner.address)).to.eq(0);
      expect(await insure.balanceOf(alice.address)).to.eq(0);

      await mine(3);

      // harvest
      await insure.harvestForMultiple(stakeA.address, [
        owner.address,
        alice.address,
      ]);
      //await insure.payOffDebtAll(tokenA.address);
      // there was already 2 in the pool, this get distributed to owner, the other 3 get divided.
      expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("5"));
      expect(await insure.balanceOf(owner.address)).to.eq(parseEther("5"));
      expect(await insure.balanceOf(alice.address)).to.eq(parseEther("0"));

      expect(await insure.calcUnderylingInStoredUSD()).to.eq(
        parseEther("5000")
      );
      expect((await insure.calcUnderyling()).amounts[0]).to.eq(
        parseEther("5000")
      );

      await insure.setProtocolPremium(
        PROTOCOL_X,
        tokenA.address,
        premiumPerBlock,
        usdPerPremium
      );

      await insure
        .connect(alice)
        .stake(parseEther("10"), alice.address, tokenA.address);

      await mine(4);

      // harvest
      await insure.harvestForMultiple(stakeA.address, [
        owner.address,
        alice.address,
      ]);

      expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("12"));
      expect(await insure.balanceOf(owner.address)).to.eq(parseEther("9.5"));
      expect(await insure.balanceOf(alice.address)).to.eq(parseEther("2.5"));

      expect(await insure.calcUnderylingInStoredUSD()).to.eq(
        parseEther("9500")
      );
      expect((await insure.calcUnderyling()).amounts[0]).to.eq(
        parseEther("9500")
      );

      expect(await insure.connect(alice).calcUnderylingInStoredUSD()).to.eq(
        parseEther("2500")
      );
      expect((await insure.connect(alice).calcUnderyling()).amounts[0]).to.eq(
        parseEther("2500")
      );
    });
    it("Scenario price increase", async function () {
      // initial setup
      await insure.setWeights([tokenA.address], [parseEther("1")]);
      const premiumPerBlock = parseEther("1000");
      const usdPerPremium = parseEther("1");
      await insure.setProtocolPremium(
        PROTOCOL_X,
        tokenA.address,
        premiumPerBlock,
        usdPerPremium
      );

      // stake
      await insure.stake(parseEther("10"), owner.address, tokenA.address);
      await insure
        .connect(alice)
        .stake(parseEther("10"), alice.address, tokenA.address);

      expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("2"));
      expect(await insure.balanceOf(owner.address)).to.eq(0);
      expect(await insure.balanceOf(alice.address)).to.eq(0);

      await mine(2);

      // harvest
      await insure.harvestForMultiple(stakeA.address, [
        owner.address,
        alice.address,
      ]);
      // there was already 2 in the pool, this get distributed to owner, the other 3 get divided.
      expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("5"));
      expect(await insure.balanceOf(owner.address)).to.eq(parseEther("3.5"));
      expect(await insure.balanceOf(alice.address)).to.eq(parseEther("1.5"));

      expect(await insure.calcUnderylingInStoredUSD()).to.eq(
        parseEther("3500")
      );
      expect((await insure.calcUnderyling()).amounts[0]).to.eq(
        parseEther("3500")
      );

      expect(await insure.connect(alice).calcUnderylingInStoredUSD()).to.eq(
        parseEther("1500")
      );
      expect((await insure.connect(alice).calcUnderyling()).amounts[0]).to.eq(
        parseEther("1500")
      );

      await insure.setProtocolPremium(
        PROTOCOL_X,
        tokenA.address,
        premiumPerBlock,
        usdPerPremium.mul(2)
      );

      await mine(5);

      // harvest
      await insure.harvestForMultiple(stakeA.address, [
        owner.address,
        alice.address,
      ]);

      expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("12"));
      expect(await insure.balanceOf(owner.address)).to.eq(parseEther("7"));
      expect(await insure.balanceOf(alice.address)).to.eq(parseEther("5"));

      expect(await insure.calcUnderylingInStoredUSD()).to.eq(
        parseEther("7000").mul(2)
      );
      expect((await insure.calcUnderyling()).amounts[0]).to.eq(
        parseEther("7000")
      );

      expect(await insure.connect(alice).calcUnderylingInStoredUSD()).to.eq(
        parseEther("5000").mul(2)
      );
      expect((await insure.connect(alice).calcUnderyling()).amounts[0]).to.eq(
        parseEther("5000")
      );
    });
    it("Scenario token increase", async function () {
      // initial setup
      await insure.setWeights([tokenA.address], [parseEther("1")]);
      const premiumPerBlock = parseEther("1000");
      const usdPerPremium = parseEther("1");
      await insure.setProtocolPremium(
        PROTOCOL_X,
        tokenA.address,
        premiumPerBlock,
        usdPerPremium
      );

      // stake
      await insure.stake(parseEther("10"), owner.address, tokenA.address);
      await insure
        .connect(alice)
        .stake(parseEther("10"), alice.address, tokenA.address);

      expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("2"));
      expect(await insure.balanceOf(owner.address)).to.eq(0);
      expect(await insure.balanceOf(alice.address)).to.eq(0);

      await mine(2);

      // harvest
      await insure.harvestForMultiple(stakeA.address, [
        owner.address,
        alice.address,
      ]);
      // there was already 2 in the pool, this get distributed to owner, the other 3 get divided.
      expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("5"));
      expect(await insure.balanceOf(owner.address)).to.eq(parseEther("3.5"));
      expect(await insure.balanceOf(alice.address)).to.eq(parseEther("1.5"));

      expect(await insure.calcUnderylingInStoredUSD()).to.eq(
        parseEther("3500")
      );
      expect((await insure.calcUnderyling()).amounts[0]).to.eq(
        parseEther("3500")
      );

      expect(await insure.connect(alice).calcUnderylingInStoredUSD()).to.eq(
        parseEther("1500")
      );
      expect((await insure.connect(alice).calcUnderyling()).amounts[0]).to.eq(
        parseEther("1500")
      );

      await insure.setProtocolPremium(
        PROTOCOL_X,
        tokenA.address,
        premiumPerBlock.mul(2),
        usdPerPremium
      );

      await mine(5);

      // harvest
      await insure.harvestForMultiple(stakeA.address, [
        owner.address,
        alice.address,
      ]);
      expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("18"));
      expect(await insure.balanceOf(owner.address)).to.eq(parseEther("10"));
      expect(await insure.balanceOf(alice.address)).to.eq(parseEther("8"));

      expect(await insure.calcUnderylingInStoredUSD()).to.eq(
        // 3500 + 500 (another block) + 3000 (6 blocks * 500) with multiplier
        parseEther("4000").add(parseEther("3000").mul(2))
      );
      expect((await insure.calcUnderyling()).amounts[0]).to.eq(
        parseEther("4000").add(parseEther("3000").mul(2))
      );

      expect(await insure.connect(alice).calcUnderylingInStoredUSD()).to.eq(
        parseEther("2000").add(parseEther("3000").mul(2))
      );
      expect((await insure.connect(alice).calcUnderyling()).amounts[0]).to.eq(
        parseEther("2000").add(parseEther("3000").mul(2))
      );
    });
    it("Scenario 2", async function () {
      // initial setup
      await insure.setWeights([tokenA.address], [parseEther("1")]);
      const premiumPerBlock = parseEther("1000");
      const usdPerPremium = parseEther("1");
      await insure.setProtocolPremium(
        PROTOCOL_X,
        tokenA.address,
        premiumPerBlock,
        usdPerPremium
      );

      // stake
      await insure.stake(parseEther("10"), owner.address, tokenA.address);
      await insure
        .connect(alice)
        .stake(parseEther("10"), alice.address, tokenA.address);

      expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("2"));
      expect(await insure.balanceOf(owner.address)).to.eq(0);
      expect(await insure.balanceOf(alice.address)).to.eq(0);

      await mine(2);

      // harvest
      await insure.harvestForMultiple(stakeA.address, [
        owner.address,
        alice.address,
      ]);
      // there was already 2 in the pool, this get distributed to owner, the other 3 get divided.
      expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("5"));
      expect(await insure.balanceOf(owner.address)).to.eq(parseEther("3.5"));
      expect(await insure.balanceOf(alice.address)).to.eq(parseEther("1.5"));

      expect(await insure.calcUnderylingInStoredUSD()).to.eq(
        parseEther("3500")
      );
      expect((await insure.calcUnderyling()).amounts[0]).to.eq(
        parseEther("3500")
      );

      expect(await insure.connect(alice).calcUnderylingInStoredUSD()).to.eq(
        parseEther("1500")
      );
      expect((await insure.connect(alice).calcUnderyling()).amounts[0]).to.eq(
        parseEther("1500")
      );

      await insure.setProtocolPremium(
        PROTOCOL_X,
        tokenA.address,
        premiumPerBlock.mul(2),
        usdPerPremium.div(2)
      );

      await mine(5);

      // harvest
      await insure.harvestForMultiple(stakeA.address, [
        owner.address,
        alice.address,
      ]);
      expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("18"));
      expect(await insure.balanceOf(owner.address)).to.eq(parseEther("10"));
      expect(await insure.balanceOf(alice.address)).to.eq(parseEther("8"));

      console.log((await insure.calcUnderylingInStoredUSD()).toString());
      console.log(
        (await insure.connect(alice).calcUnderylingInStoredUSD()).toString()
      );
      expect(await insure.calcUnderylingInStoredUSD()).to.eq(
        // og value of 4k was divided by 2, 500 was added for 6 blocks
        parseEther("4000").div(2).add(parseEther("3000"))
      );
      expect((await insure.calcUnderyling()).amounts[0]).to.eq(
        parseEther("4000").add(parseEther("3000").mul(2))
      );

      expect(await insure.connect(alice).calcUnderylingInStoredUSD()).to.eq(
        parseEther("2000").div(2).add(parseEther("3000"))
      );
      expect((await insure.connect(alice).calcUnderyling()).amounts[0]).to.eq(
        parseEther("2000").add(parseEther("3000").mul(2))
      );
    });
  });
  describe("stake(), multi", function () {
    beforeEach(async function () {
      await timeTraveler.revertSnapshot();
      await insure.tokenAdd(tokenB.address, stakeB.address, owner.address);
    });
    it("Multis stale", async function () {
      // initial setup
      await insure.setWeights([tokenA.address], [parseEther("1")]);
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

      // stake
      await insure.stake(parseEther("10"), owner.address, tokenA.address);
      await insure
        .connect(alice)
        .stake(parseEther("10"), alice.address, tokenA.address);

      expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("2"));
      expect(await insure.balanceOf(owner.address)).to.eq(0);
      expect(await insure.balanceOf(alice.address)).to.eq(0);

      await mine(2);

      // harvest
      await insure.harvestForMultipleMulti(
        [stakeA.address],
        [owner.address, alice.address],
        [stakeB.address]
      );
      //await insure.payOffDebtAll(tokenA.address);
      // there was already 2 in the pool, this get distributed to owner, the other 3 get divided.
      expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("5"));
      expect(await insure.balanceOf(owner.address)).to.eq(parseEther("3.5"));
      expect(await insure.balanceOf(alice.address)).to.eq(parseEther("1.5"));

      expect(await insure.calcUnderylingInStoredUSD()).to.eq(
        parseEther("7000")
      );
      expect((await insure.calcUnderyling()).amounts[0]).to.eq(
        parseEther("3500")
      );
      expect((await insure.calcUnderyling()).amounts[1]).to.eq(
        parseEther("17.5")
      );

      expect(await insure.connect(alice).calcUnderylingInStoredUSD()).to.eq(
        parseEther("3000")
      );
      expect((await insure.connect(alice).calcUnderyling()).amounts[0]).to.eq(
        parseEther("1500")
      );
      expect((await insure.connect(alice).calcUnderyling()).amounts[1]).to.eq(
        parseEther("7.5")
      );

      await insure.setProtocolPremiums(
        PROTOCOL_X,
        [tokenA.address, tokenB.address],
        [ApremiumPerBlock, BpremiumPerBlock],
        [AusdPerPremium, BusdPerPremium]
      );

      await mine(5);

      // harvest
      await insure.harvestForMultipleMulti(
        [stakeA.address],
        [owner.address, alice.address],
        [stakeB.address]
      );

      expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("12"));
      expect(await insure.balanceOf(owner.address)).to.eq(parseEther("7"));
      expect(await insure.balanceOf(alice.address)).to.eq(parseEther("5"));

      expect(await insure.calcUnderylingInStoredUSD()).to.eq(
        parseEther("14000")
      );
      expect((await insure.calcUnderyling()).amounts[0]).to.eq(
        parseEther("7000")
      );
      expect((await insure.calcUnderyling()).amounts[1]).to.eq(
        parseEther("35")
      );

      expect(await insure.connect(alice).calcUnderylingInStoredUSD()).to.eq(
        parseEther("10000")
      );
      expect((await insure.connect(alice).calcUnderyling()).amounts[0]).to.eq(
        parseEther("5000")
      );
      expect((await insure.connect(alice).calcUnderyling()).amounts[1]).to.eq(
        parseEther("25")
      );
    });
    it("Multis, scenario 3", async function () {
      // initial setup
      await insure.setWeights(
        [tokenA.address, tokenB.address],
        [parseEther("1"), parseEther("0")]
      );
      const ApremiumPerBlock = parseEther("1000");
      const AusdPerPremium = parseEther("1");

      const BpremiumPerBlock = parseEther("5");
      const BusdPerPremium = parseEther("200");
      const b2 = await blockNumber(
        insure.setProtocolPremiums(
          PROTOCOL_X,
          [tokenA.address, tokenB.address],
          [ApremiumPerBlock, BpremiumPerBlock],
          [AusdPerPremium, BusdPerPremium]
        )
      );

      // stake
      await insure.stake(parseEther("10"), owner.address, tokenA.address);

      expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("1"));
      expect(await insure.balanceOf(owner.address)).to.eq(0);
      expect(await insure.balanceOf(alice.address)).to.eq(0);

      await mine(3);

      // harvest
      await insure.harvestForMultipleMulti(
        [stakeA.address],
        [owner.address, alice.address],
        [stakeB.address]
      );

      expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("5"));
      expect(await insure.balanceOf(owner.address)).to.eq(parseEther("5"));
      expect(await insure.balanceOf(alice.address)).to.eq(parseEther("0"));

      expect(await insure.calcUnderylingInStoredUSD()).to.eq(
        parseEther("10000")
      );
      expect((await insure.calcUnderyling()).amounts[0]).to.eq(
        parseEther("5000")
      );
      expect((await insure.calcUnderyling()).amounts[1]).to.eq(
        parseEther("25")
      );

      await insure.setProtocolPremiums(
        PROTOCOL_X,
        [tokenA.address, tokenB.address],
        [ApremiumPerBlock, BpremiumPerBlock.mul(4)],
        [AusdPerPremium, BusdPerPremium.div(4)]
      );

      const b = await blockNumber(
        await insure
          .connect(alice)
          .stake(parseEther("10"), alice.address, tokenA.address)
      );

      await mine(4);

      // harvest
      const b1 = await blockNumber(
        insure.harvestForMultipleMulti(
          [stakeA.address],
          [owner.address, alice.address],
          [stakeB.address]
        )
      );

      expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("15.6"));
      expect(await insure.balanceOf(owner.address)).to.eq(parseEther("11.6"));
      expect(await insure.balanceOf(alice.address)).to.eq(parseEther("4"));

      // total ETH 150: 30 (6*5) + 120 (6*20)
      expect(await insure.calcUnderylingInStoredUSD()).to.eq(
        parseEther("14500").sub(1)
      );
      expect((await insure.calcUnderyling()).amounts[0]).to.eq(
        parseEther("8923.076923076923076923")
      );
      expect((await insure.calcUnderyling()).amounts[1]).to.eq(
        parseEther("111.538461538461538461")
      );

      expect(await insure.connect(alice).calcUnderylingInStoredUSD()).to.eq(
        parseEther("5000").sub(1)
      );
      expect((await insure.connect(alice).calcUnderyling()).amounts[0]).to.eq(
        parseEther("3076.923076923076923076")
      );
      expect((await insure.connect(alice).calcUnderyling()).amounts[1]).to.eq(
        parseEther("38.461538461538461538")
      );
    });
  });
});
