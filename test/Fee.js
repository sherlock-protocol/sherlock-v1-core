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
    // await insure.tokenAdd(tokenB.address, stakeB.address, owner.address);
    await insure.protocolAdd(PROTOCOL_X, owner.address, owner.address);

    await timeTraveler.snapshot();
  });
  describe("stake(), scenario 1", function () {
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
    it.only("Scenario 2", async function () {
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
      
      await insure.setProtocolPremium(
        PROTOCOL_X,
        tokenA.address,
        premiumPerBlock,
        usdPerPremium
      );

      // harvest
      await insure.harvestForMultiple(stakeA.address, [
        owner.address,
        alice.address,
      ]);
      await insure.payOffDebtAll(tokenA.address);
      // there was already 2 in the pool, this get distributed to owner, the other 3 get divided.
      expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("5"));
      expect(await insure.balanceOf(owner.address)).to.eq(parseEther("3.5"));
      expect(await insure.balanceOf(alice.address)).to.eq(parseEther("1.5"));

      expect(await insure.calcUnderylingInStoredUSD()).to.eq(
        parseEther("4200")
      );
      expect((await insure.calcUnderyling()).amounts[0]).to.eq(
        parseEther("4200")
      );

      expect(await insure.connect(alice).calcUnderylingInStoredUSD()).to.eq(
        parseEther("1800")
      );
      expect((await insure.connect(alice).calcUnderyling()).amounts[0]).to.eq(
        parseEther("1800")
      );

      // await insure.setProtocolPremium(
      //   PROTOCOL_X,
      //   tokenA.address,
      //   premiumPerBlock,
      //   usdPerPremium
      // );

      // await mine(2);

      // // harvest
      // await insure.harvestForMultiple(stakeA.address, [
      //   owner.address,
      //   alice.address,
      // ]);
      // await insure.payOffDebtAll(tokenA.address);

      // console.log((await insure.calcUnderyling()).amounts[0].toString());
      // console.log(
      //   (await insure.connect(alice).calcUnderyling()).amounts[0].toString()
      // );
      // //expect(await insure.getFeePool(tokenA.address)).to.eq(parseEther("5"));
      // expect((await insure.calcUnderyling()).amounts[0]).to.eq(
      //   parseEther("4200")
      // );
    });
  });
});
