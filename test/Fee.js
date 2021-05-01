// TODO rewrite tests at later stage

// const { expect } = require("chai");
// const { utils } = require("ethers/lib");
// const { parseEther, parseUnits } = require("ethers/lib/utils");
// const { constants } = require("ethers");
// const { insurance, erc20, tvl, blockNumber, mine } = require("./utils.js");
// const { TimeTraveler } = require("./utils-snapshot.js");

// const PROTOCOL_X =
//   "0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7";

// const hundredPercent = ethers.BigNumber.from("10").pow(18);

// describe("Fee tests", function () {
//   before(async function () {
//     timeTraveler = new TimeTraveler(network.provider);

//     [owner, alice, bob] = await ethers.getSigners();
//     [owner.address, alice.address, bob.address] = [
//       await owner.getAddress(),
//       await alice.getAddress(),
//       await bob.getAddress(),
//     ];

//     insure = await insurance(owner.address);
//     await insure.setInitialGovInsurance(owner.address);

//     const Token = await ethers.getContractFactory("MockToken");
//     [tokenA, tokenB, tokenC] = [
//       await Token.deploy("TokenA", "A", parseEther("1000")),
//       await Token.deploy("TokenB", "B", parseEther("1000")),
//       await Token.deploy("TokenC", "C", parseEther("1000")),
//     ];
//     await tokenA.transfer(alice.address, parseEther("100"));
//     await tokenA.transfer(bob.address, parseEther("100"));
//     await tokenA.approve(insure.address, constants.MaxUint256);
//     await tokenB.approve(insure.address, constants.MaxUint256);
//     await tokenA.connect(alice).approve(insure.address, constants.MaxUint256);
//     await tokenA.connect(bob).approve(insure.address, constants.MaxUint256);

//     const Stake = await ethers.getContractFactory("NativeLock");
//     const StakeFee = await ethers.getContractFactory("StakeFee");
//     [stakeA, stakeB, stakeC] = [
//       await Stake.deploy("Stake TokenA", "stkA", tokenA.address),
//       await Stake.deploy("Stake TokenB", "stkB", tokenB.address),
//       await Stake.deploy("Stake TokenC", "stkC", tokenC.address),
//     ];
//     stakeFee = await StakeFee.deploy("Stake Fee", "stkFEE");
//     await stakeFee.transferOwnership(insure.address);

//     await stakeA.approve(insure.address, constants.MaxUint256);
//     await stakeB.approve(insure.address, constants.MaxUint256);
//     await stakeA.transferOwnership(insure.address);
//     await stakeB.transferOwnership(insure.address);
//     await stakeC.transferOwnership(insure.address);

//     await insure.tokenAdd(tokenA.address, stakeA.address, owner.address);
//     await insure.tokenAdd(insure.address, stakeFee.address, owner.address);
//     // await insure.tokenAdd(tokenB.address, stakeB.address, owner.address);
//     await insure.protocolAdd(PROTOCOL_X, owner.address, owner.address);

//     await timeTraveler.snapshot();
//   });
//   describe("stake(), single", function () {
//     beforeEach(async function () {
//       await timeTraveler.revertSnapshot();
//     });

//     it("Scenario 1", async function () {
//       // initial setup
//       await insure.setWeights([tokenA.address], [parseEther("1")]);
//       const premiumPerBlock = parseEther("1000");
//       const usdPerPremium = parseEther("1");
//       const t1 = await blockNumber(
//         insure.setProtocolPremium(
//           PROTOCOL_X,
//           tokenA.address,
//           premiumPerBlock,
//           usdPerPremium
//         )
//       );

//       // stake
//       await insure.stake(parseEther("10"), owner.address, tokenA.address);
//       expect(await insure.totalSupply()).to.eq(0);
//       expect(await insure.balanceOf(owner.address)).to.eq(0);

//       await mine(3);

//       // transfer
//       await insure.harvest(stakeA.address);
//       expect(await insure.totalSupply()).to.eq(parseEther("5"));
//       expect(await stakeFee.balanceOf(owner.address)).to.eq(parseEther("1"));
//       expect(await insure.exchangeRate(insure.address)).to.eq(parseEther("5"));

//       const t2 = await blockNumber(insure.payOffDebtAll(tokenA.address));
//       // returns 0 value for user as the user doesn't hold any fee (it is deposited into the pool)
//       const underlying = await insure["calcUnderlying(uint256)"](
//         parseEther("5") // amount of FEE deposited for user
//       );
//       const underlyingUSD = await insure.calcUnderlyingInStoredUSDFor(
//         parseEther("5")
//       );

//       expect(t2.sub(t1).mul(premiumPerBlock)).to.eq(underlying.amounts[0]);
//       expect(
//         t2.sub(t1).mul(premiumPerBlock).mul(usdPerPremium).div(hundredPercent)
//       ).to.eq(underlyingUSD);
//     });
//     it.only("Scenario stale", async function () {
//       // initial setup
//       await insure.setWeights([tokenA.address], [parseEther("1")]);
//       const premiumPerBlock = parseEther("1000");
//       const usdPerPremium = parseEther("1");
//       await insure.setProtocolPremium(
//         PROTOCOL_X,
//         tokenA.address,
//         premiumPerBlock,
//         usdPerPremium
//       );

//       // stake
//       await insure.stake(parseEther("10"), owner.address, tokenA.address);
//       await insure
//         .connect(alice)
//         .stake(parseEther("10"), alice.address, tokenA.address);

//       expect(await insure.balanceOf(owner.address)).to.eq(0);
//       expect(await insure.balanceOf(alice.address)).to.eq(0);

//       await mine(2);

//       // harvest
//       await insure.harvestForMultiple(stakeA.address, [
//         owner.address,
//         alice.address,
//       ]);
//       //await insure.payOffDebtAll(tokenA.address);
//       // there was already 2 in the pool, this get distributed to owner, the other 3 get divided.
//       expect(await stakeFee.balanceOf(owner.address)).to.eq(parseEther("1"));
//       expect(await stakeFee.balanceOf(alice.address)).to.eq(
//         parseEther("0.428571428571428571")
//       );
//       expect(await insure.exchangeRate(insure.address)).to.eq(
//         parseEther("3.5").add(1)
//       );

//       expect(await insure.calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("3500")
//       );
//       expect((await insure.calcUnderlying()).amounts[0]).to.eq(
//         parseEther("3500")
//       );

//       expect(await insure.connect(alice).calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("1500")
//       );
//       expect((await insure.connect(alice).calcUnderlying()).amounts[0]).to.eq(
//         parseEther("1500")
//       );

//       await insure.setProtocolPremium(
//         PROTOCOL_X,
//         tokenA.address,
//         premiumPerBlock,
//         usdPerPremium
//       );

//       await mine(5);

//       // harvest
//       await insure.harvestForMultiple(stakeA.address, [
//         owner.address,
//         alice.address,
//       ]);

//       expect(await insure.balanceOf(owner.address)).to.eq(parseEther("7"));
//       expect(await insure.balanceOf(alice.address)).to.eq(parseEther("5"));

//       expect(await insure.calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("7000")
//       );
//       expect((await insure.calcUnderlying()).amounts[0]).to.eq(
//         parseEther("7000")
//       );

//       expect(await insure.connect(alice).calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("5000")
//       );
//       expect((await insure.connect(alice).calcUnderlying()).amounts[0]).to.eq(
//         parseEther("5000")
//       );
//     });
//     it("Scenario stale, join later", async function () {
//       // initial setup
//       await insure.setWeights([tokenA.address], [parseEther("1")]);
//       const premiumPerBlock = parseEther("1000");
//       const usdPerPremium = parseEther("1");
//       await insure.setProtocolPremium(
//         PROTOCOL_X,
//         tokenA.address,
//         premiumPerBlock,
//         usdPerPremium
//       );

//       // stake
//       await insure.stake(parseEther("10"), owner.address, tokenA.address);

//       expect(await insure.balanceOf(owner.address)).to.eq(0);
//       expect(await insure.balanceOf(alice.address)).to.eq(0);

//       await mine(3);

//       // harvest
//       await insure.harvestForMultiple(stakeA.address, [
//         owner.address,
//         alice.address,
//       ]);
//       //await insure.payOffDebtAll(tokenA.address);
//       // there was already 2 in the pool, this get distributed to owner, the other 3 get divided.
//       expect(await insure.balanceOf(owner.address)).to.eq(parseEther("5"));
//       expect(await insure.balanceOf(alice.address)).to.eq(parseEther("0"));

//       expect(await insure.calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("5000")
//       );
//       expect((await insure.calcUnderlying()).amounts[0]).to.eq(
//         parseEther("5000")
//       );

//       await insure.setProtocolPremium(
//         PROTOCOL_X,
//         tokenA.address,
//         premiumPerBlock,
//         usdPerPremium
//       );

//       await insure
//         .connect(alice)
//         .stake(parseEther("10"), alice.address, tokenA.address);

//       await mine(4);

//       // harvest
//       await insure.harvestForMultiple(stakeA.address, [
//         owner.address,
//         alice.address,
//       ]);

//       expect(await insure.balanceOf(owner.address)).to.eq(parseEther("9.5"));
//       expect(await insure.balanceOf(alice.address)).to.eq(parseEther("2.5"));

//       expect(await insure.calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("9500")
//       );
//       expect((await insure.calcUnderlying()).amounts[0]).to.eq(
//         parseEther("9500")
//       );

//       expect(await insure.connect(alice).calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("2500")
//       );
//       expect((await insure.connect(alice).calcUnderlying()).amounts[0]).to.eq(
//         parseEther("2500")
//       );
//     });
//     it("Scenario price increase", async function () {
//       // initial setup
//       await insure.setWeights([tokenA.address], [parseEther("1")]);
//       const premiumPerBlock = parseEther("1000");
//       const usdPerPremium = parseEther("1");
//       await insure.setProtocolPremium(
//         PROTOCOL_X,
//         tokenA.address,
//         premiumPerBlock,
//         usdPerPremium
//       );

//       // stake
//       await insure.stake(parseEther("10"), owner.address, tokenA.address);
//       await insure
//         .connect(alice)
//         .stake(parseEther("10"), alice.address, tokenA.address);

//       expect(await insure.balanceOf(owner.address)).to.eq(0);
//       expect(await insure.balanceOf(alice.address)).to.eq(0);

//       await mine(2);

//       // harvest
//       await insure.harvestForMultiple(stakeA.address, [
//         owner.address,
//         alice.address,
//       ]);
//       // there was already 2 in the pool, this get distributed to owner, the other 3 get divided.
//       expect(await insure.balanceOf(owner.address)).to.eq(parseEther("3.5"));
//       expect(await insure.balanceOf(alice.address)).to.eq(parseEther("1.5"));

//       expect(await insure.calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("3500")
//       );
//       expect((await insure.calcUnderlying()).amounts[0]).to.eq(
//         parseEther("3500")
//       );

//       expect(await insure.connect(alice).calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("1500")
//       );
//       expect((await insure.connect(alice).calcUnderlying()).amounts[0]).to.eq(
//         parseEther("1500")
//       );

//       await insure.setProtocolPremium(
//         PROTOCOL_X,
//         tokenA.address,
//         premiumPerBlock,
//         usdPerPremium.mul(2)
//       );

//       await mine(5);

//       // harvest
//       await insure.harvestForMultiple(stakeA.address, [
//         owner.address,
//         alice.address,
//       ]);

//       expect(await insure.balanceOf(owner.address)).to.eq(parseEther("7"));
//       expect(await insure.balanceOf(alice.address)).to.eq(parseEther("5"));

//       expect(await insure.calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("7000").mul(2)
//       );
//       expect((await insure.calcUnderlying()).amounts[0]).to.eq(
//         parseEther("7000")
//       );

//       expect(await insure.connect(alice).calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("5000").mul(2)
//       );
//       expect((await insure.connect(alice).calcUnderlying()).amounts[0]).to.eq(
//         parseEther("5000")
//       );
//     });
//     it("Scenario token increase", async function () {
//       // initial setup
//       await insure.setWeights([tokenA.address], [parseEther("1")]);
//       const premiumPerBlock = parseEther("1000");
//       const usdPerPremium = parseEther("1");
//       await insure.setProtocolPremium(
//         PROTOCOL_X,
//         tokenA.address,
//         premiumPerBlock,
//         usdPerPremium
//       );

//       // stake
//       await insure.stake(parseEther("10"), owner.address, tokenA.address);
//       await insure
//         .connect(alice)
//         .stake(parseEther("10"), alice.address, tokenA.address);

//       expect(await insure.balanceOf(owner.address)).to.eq(0);
//       expect(await insure.balanceOf(alice.address)).to.eq(0);

//       await mine(2);

//       // harvest
//       await insure.harvestForMultiple(stakeA.address, [
//         owner.address,
//         alice.address,
//       ]);
//       // there was already 2 in the pool, this get distributed to owner, the other 3 get divided.
//       expect(await insure.balanceOf(owner.address)).to.eq(parseEther("3.5"));
//       expect(await insure.balanceOf(alice.address)).to.eq(parseEther("1.5"));

//       expect(await insure.calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("3500")
//       );
//       expect((await insure.calcUnderlying()).amounts[0]).to.eq(
//         parseEther("3500")
//       );

//       expect(await insure.connect(alice).calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("1500")
//       );
//       expect((await insure.connect(alice).calcUnderlying()).amounts[0]).to.eq(
//         parseEther("1500")
//       );

//       await insure.setProtocolPremium(
//         PROTOCOL_X,
//         tokenA.address,
//         premiumPerBlock.mul(2),
//         usdPerPremium
//       );

//       await mine(5);

//       // harvest
//       await insure.harvestForMultiple(stakeA.address, [
//         owner.address,
//         alice.address,
//       ]);
//       expect(await insure.balanceOf(owner.address)).to.eq(parseEther("10"));
//       expect(await insure.balanceOf(alice.address)).to.eq(parseEther("8"));

//       expect(await insure.calcUnderlyingInStoredUSD()).to.eq(
//         // 3500 + 500 (another block) + 3000 (6 blocks * 500) with multiplier
//         parseEther("4000").add(parseEther("3000").mul(2))
//       );
//       expect((await insure.calcUnderlying()).amounts[0]).to.eq(
//         parseEther("4000").add(parseEther("3000").mul(2))
//       );

//       expect(await insure.connect(alice).calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("2000").add(parseEther("3000").mul(2))
//       );
//       expect((await insure.connect(alice).calcUnderlying()).amounts[0]).to.eq(
//         parseEther("2000").add(parseEther("3000").mul(2))
//       );
//     });
//     it("Scenario 2", async function () {
//       // initial setup
//       await insure.setWeights([tokenA.address], [parseEther("1")]);
//       const premiumPerBlock = parseEther("1000");
//       const usdPerPremium = parseEther("1");
//       await insure.setProtocolPremium(
//         PROTOCOL_X,
//         tokenA.address,
//         premiumPerBlock,
//         usdPerPremium
//       );

//       // stake
//       await insure.stake(parseEther("10"), owner.address, tokenA.address);
//       await insure
//         .connect(alice)
//         .stake(parseEther("10"), alice.address, tokenA.address);

//       expect(await insure.balanceOf(owner.address)).to.eq(0);
//       expect(await insure.balanceOf(alice.address)).to.eq(0);

//       await mine(2);

//       // harvest
//       await insure.harvestForMultiple(stakeA.address, [
//         owner.address,
//         alice.address,
//       ]);
//       // there was already 2 in the pool, this get distributed to owner, the other 3 get divided.
//       expect(await insure.balanceOf(owner.address)).to.eq(parseEther("3.5"));
//       expect(await insure.balanceOf(alice.address)).to.eq(parseEther("1.5"));

//       expect(await insure.calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("3500")
//       );
//       expect((await insure.calcUnderlying()).amounts[0]).to.eq(
//         parseEther("3500")
//       );

//       expect(await insure.connect(alice).calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("1500")
//       );
//       expect((await insure.connect(alice).calcUnderlying()).amounts[0]).to.eq(
//         parseEther("1500")
//       );

//       await insure.setProtocolPremium(
//         PROTOCOL_X,
//         tokenA.address,
//         premiumPerBlock.mul(2),
//         usdPerPremium.div(2)
//       );

//       await mine(5);

//       // harvest
//       await insure.harvestForMultiple(stakeA.address, [
//         owner.address,
//         alice.address,
//       ]);
//       expect(await insure.balanceOf(owner.address)).to.eq(parseEther("10"));
//       expect(await insure.balanceOf(alice.address)).to.eq(parseEther("8"));

//       expect(await insure.calcUnderlyingInStoredUSD()).to.eq(
//         // og value of 4k was divided by 2, 500 was added for 6 blocks
//         parseEther("4000").div(2).add(parseEther("3000"))
//       );
//       expect((await insure.calcUnderlying()).amounts[0]).to.eq(
//         parseEther("4000").add(parseEther("3000").mul(2))
//       );

//       expect(await insure.connect(alice).calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("2000").div(2).add(parseEther("3000"))
//       );
//       expect((await insure.connect(alice).calcUnderlying()).amounts[0]).to.eq(
//         parseEther("2000").add(parseEther("3000").mul(2))
//       );
//     });
//   });
//   describe("stake(), multi", function () {
//     beforeEach(async function () {
//       await timeTraveler.revertSnapshot();
//       await insure.tokenAdd(tokenB.address, stakeB.address, owner.address);
//     });
//     it("Multis stale", async function () {
//       // initial setup
//       await insure.setWeights([tokenA.address], [parseEther("1")]);
//       const ApremiumPerBlock = parseEther("1000");
//       const AusdPerPremium = parseEther("1");

//       const BpremiumPerBlock = parseEther("5");
//       const BusdPerPremium = parseEther("200");
//       await insure.setProtocolPremiums(
//         PROTOCOL_X,
//         [tokenA.address, tokenB.address],
//         [ApremiumPerBlock, BpremiumPerBlock],
//         [AusdPerPremium, BusdPerPremium]
//       );

//       // stake
//       await insure.stake(parseEther("10"), owner.address, tokenA.address);
//       await insure
//         .connect(alice)
//         .stake(parseEther("10"), alice.address, tokenA.address);

//       expect(await insure.balanceOf(owner.address)).to.eq(0);
//       expect(await insure.balanceOf(alice.address)).to.eq(0);

//       await mine(2);

//       // harvest
//       await insure.harvestForMultipleMulti(
//         [stakeA.address],
//         [owner.address, alice.address],
//         [stakeB.address]
//       );
//       //await insure.payOffDebtAll(tokenA.address);
//       // there was already 2 in the pool, this get distributed to owner, the other 3 get divided.
//       expect(await insure.balanceOf(owner.address)).to.eq(parseEther("3.5"));
//       expect(await insure.balanceOf(alice.address)).to.eq(parseEther("1.5"));

//       expect(await insure.calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("7000")
//       );
//       expect((await insure.calcUnderlying()).amounts[0]).to.eq(
//         parseEther("3500")
//       );
//       expect((await insure.calcUnderlying()).amounts[1]).to.eq(
//         parseEther("17.5")
//       );

//       expect(await insure.connect(alice).calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("3000")
//       );
//       expect((await insure.connect(alice).calcUnderlying()).amounts[0]).to.eq(
//         parseEther("1500")
//       );
//       expect((await insure.connect(alice).calcUnderlying()).amounts[1]).to.eq(
//         parseEther("7.5")
//       );

//       await insure.setProtocolPremiums(
//         PROTOCOL_X,
//         [tokenA.address, tokenB.address],
//         [ApremiumPerBlock, BpremiumPerBlock],
//         [AusdPerPremium, BusdPerPremium]
//       );

//       await mine(5);

//       // harvest
//       await insure.harvestForMultipleMulti(
//         [stakeA.address],
//         [owner.address, alice.address],
//         [stakeB.address]
//       );

//       expect(await insure.balanceOf(owner.address)).to.eq(parseEther("7"));
//       expect(await insure.balanceOf(alice.address)).to.eq(parseEther("5"));

//       expect(await insure.calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("14000")
//       );
//       expect((await insure.calcUnderlying()).amounts[0]).to.eq(
//         parseEther("7000")
//       );
//       expect((await insure.calcUnderlying()).amounts[1]).to.eq(
//         parseEther("35")
//       );

//       expect(await insure.connect(alice).calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("10000")
//       );
//       expect((await insure.connect(alice).calcUnderlying()).amounts[0]).to.eq(
//         parseEther("5000")
//       );
//       expect((await insure.connect(alice).calcUnderlying()).amounts[1]).to.eq(
//         parseEther("25")
//       );
//     });
//     it("Multis, scenario 3", async function () {
//       // initial setup
//       await insure.setWeights(
//         [tokenA.address, tokenB.address],
//         [parseEther("1"), parseEther("0")]
//       );
//       const ApremiumPerBlock = parseEther("1000");
//       const AusdPerPremium = parseEther("1");

//       const BpremiumPerBlock = parseEther("5");
//       const BusdPerPremium = parseEther("200");
//       await insure.setProtocolPremiums(
//         PROTOCOL_X,
//         [tokenA.address, tokenB.address],
//         [ApremiumPerBlock, BpremiumPerBlock],
//         [AusdPerPremium, BusdPerPremium]
//       );

//       // stake
//       await insure.stake(parseEther("10"), owner.address, tokenA.address);

//       expect(await insure.balanceOf(owner.address)).to.eq(0);
//       expect(await insure.balanceOf(alice.address)).to.eq(0);

//       await mine(3);

//       // harvest
//       await insure.harvestForMultipleMulti(
//         [stakeA.address],
//         [owner.address, alice.address],
//         [stakeB.address]
//       );

//       expect(await insure.balanceOf(owner.address)).to.eq(parseEther("5"));
//       expect(await insure.balanceOf(alice.address)).to.eq(parseEther("0"));

//       expect(await insure.calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("10000")
//       );
//       expect((await insure.calcUnderlying()).amounts[0]).to.eq(
//         parseEther("5000")
//       );
//       expect((await insure.calcUnderlying()).amounts[1]).to.eq(
//         parseEther("25")
//       );

//       await insure.setProtocolPremiums(
//         PROTOCOL_X,
//         [tokenA.address, tokenB.address],
//         [ApremiumPerBlock, BpremiumPerBlock.mul(4)],
//         [AusdPerPremium, BusdPerPremium.div(4)]
//       );

//       await insure
//         .connect(alice)
//         .stake(parseEther("10"), alice.address, tokenA.address);

//       await mine(4);

//       // harvest
//       await insure.harvestForMultipleMulti(
//         [stakeA.address],
//         [owner.address, alice.address],
//         [stakeB.address]
//       );

//       expect(await insure.balanceOf(owner.address)).to.eq(parseEther("11.6"));
//       expect(await insure.balanceOf(alice.address)).to.eq(parseEther("4"));

//       // total ETH 150: 30 (6*5) + 120 (6*20)
//       expect(await insure.calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("14500").sub(1)
//       );
//       expect((await insure.calcUnderlying()).amounts[0]).to.eq(
//         parseEther("8923.076923076923076923")
//       );
//       expect((await insure.calcUnderlying()).amounts[1]).to.eq(
//         parseEther("111.538461538461538461")
//       );

//       expect(await insure.connect(alice).calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("5000").sub(1)
//       );
//       expect((await insure.connect(alice).calcUnderlying()).amounts[0]).to.eq(
//         parseEther("3076.923076923076923076")
//       );
//       expect((await insure.connect(alice).calcUnderlying()).amounts[1]).to.eq(
//         parseEther("38.461538461538461538")
//       );
//     });
//     it("Multis, scenario 4", async function () {
//       // initial setup
//       await insure.setWeights(
//         [tokenA.address, tokenB.address],
//         [parseEther("1"), parseEther("0")]
//       );
//       const ApremiumPerBlock = parseEther("1000");
//       const AusdPerPremium = parseEther("1");

//       const BpremiumPerBlock = parseEther("5");
//       const BusdPerPremium = parseEther("200");
//       await insure.setProtocolPremiums(
//         PROTOCOL_X,
//         [tokenA.address, tokenB.address],
//         [ApremiumPerBlock, BpremiumPerBlock],
//         [AusdPerPremium, BusdPerPremium]
//       );

//       // stake
//       await insure.stake(parseEther("10"), owner.address, tokenA.address);

//       expect(await insure.balanceOf(owner.address)).to.eq(0);
//       expect(await insure.balanceOf(alice.address)).to.eq(0);

//       await mine(3);

//       // harvest
//       await insure.harvestForMultipleMulti(
//         [stakeA.address],
//         [owner.address, alice.address],
//         [stakeB.address]
//       );

//       expect(await insure.balanceOf(owner.address)).to.eq(parseEther("5"));
//       expect(await insure.balanceOf(alice.address)).to.eq(parseEther("0"));

//       expect(await insure.calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("10000")
//       );
//       expect((await insure.calcUnderlying()).amounts[0]).to.eq(
//         parseEther("5000")
//       );
//       expect((await insure.calcUnderlying()).amounts[1]).to.eq(
//         parseEther("25")
//       );

//       await insure.setProtocolPremiums(
//         PROTOCOL_X,
//         [tokenA.address, tokenB.address],
//         [ApremiumPerBlock, BpremiumPerBlock.mul(2)],
//         [AusdPerPremium, BusdPerPremium]
//       );

//       await insure
//         .connect(alice)
//         .stake(parseEther("10"), alice.address, tokenA.address);

//       await mine(4);

//       // harvest
//       await insure.harvestForMultipleMulti(
//         [stakeA.address],
//         [owner.address, alice.address],
//         [stakeB.address]
//       );

//       expect(await insure.balanceOf(owner.address)).to.eq(parseEther("11.25"));
//       expect(await insure.balanceOf(alice.address)).to.eq(parseEther("3.75"));

//       expect(await insure.calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("22500")
//       );

//       // 3000pb, 5 blocks = 15k / 2 = 7.5k
//       expect(await insure.connect(alice).calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("7500")
//       );
//     });
//     it("Multis, scenario 5", async function () {
//       // initial setup
//       await insure.setWeights(
//         [tokenA.address, tokenB.address],
//         [parseEther("1"), parseEther("0")]
//       );
//       const ApremiumPerBlock = parseEther("1000");
//       const AusdPerPremium = parseEther("1");

//       const BpremiumPerBlock = parseEther("5");
//       const BusdPerPremium = parseEther("200");
//       await insure.setProtocolPremiums(
//         PROTOCOL_X,
//         [tokenA.address, tokenB.address],
//         [ApremiumPerBlock, BpremiumPerBlock],
//         [AusdPerPremium, BusdPerPremium]
//       );

//       // stake
//       await insure.stake(parseEther("10"), owner.address, tokenA.address);

//       expect(await insure.balanceOf(owner.address)).to.eq(0);
//       expect(await insure.balanceOf(alice.address)).to.eq(0);

//       await mine(3);

//       // harvest
//       await insure.harvestForMultipleMulti(
//         [stakeA.address],
//         [owner.address, alice.address],
//         [stakeB.address]
//       );

//       expect(await insure.balanceOf(owner.address)).to.eq(parseEther("5"));
//       expect(await insure.balanceOf(alice.address)).to.eq(parseEther("0"));

//       expect(await insure.calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("10000")
//       );
//       expect((await insure.calcUnderlying()).amounts[0]).to.eq(
//         parseEther("5000")
//       );
//       expect((await insure.calcUnderlying()).amounts[1]).to.eq(
//         parseEther("25")
//       );

//       await insure.setProtocolPremiums(
//         PROTOCOL_X,
//         [tokenA.address, tokenB.address],
//         [ApremiumPerBlock, BpremiumPerBlock.mul(2)],
//         [AusdPerPremium, BusdPerPremium.mul(150).div(100)]
//       );

//       await insure
//         .connect(alice)
//         .stake(parseEther("10"), alice.address, tokenA.address);

//       await mine(4);

//       // harvest
//       await insure.harvestForMultipleMulti(
//         [stakeA.address],
//         [owner.address, alice.address],
//         [stakeB.address]
//       );

//       expect(await insure.balanceOf(owner.address)).to.eq(parseEther("11.6"));
//       expect(await insure.balanceOf(alice.address)).to.eq(parseEther("4"));

//       // 6 blocks * 5 = 30 ETH + 6kDAI
//       // 30 eth, 6k$ -> 9k$
//       // 15k$
//       // 1 block = 4k$ extra (1k DAI, 10 ETH)
//       // 15k + 4k + 10k
//       expect(await insure.calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("29000").sub(1)
//       );

//       // 4000pb, 5 blocks = 20k / 2 = 10k
//       expect(await insure.connect(alice).calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("10000").sub(1)
//       );
//     });
//     it("Multis, scenario 6", async function () {
//       // initial setup
//       await insure.setWeights(
//         [tokenA.address, tokenB.address],
//         [parseEther("1"), parseEther("0")]
//       );
//       const ApremiumPerBlock = parseEther("1000");
//       const AusdPerPremium = parseEther("1");

//       const BpremiumPerBlock = parseEther("5");
//       const BusdPerPremium = parseEther("200");
//       await insure.setProtocolPremiums(
//         PROTOCOL_X,
//         [tokenA.address, tokenB.address],
//         [ApremiumPerBlock, BpremiumPerBlock],
//         [AusdPerPremium, BusdPerPremium]
//       );

//       // stake
//       await insure.stake(parseEther("10"), owner.address, tokenA.address);

//       expect(await insure.balanceOf(owner.address)).to.eq(0);
//       expect(await insure.balanceOf(alice.address)).to.eq(0);

//       await mine(3);

//       // harvest
//       await insure.harvestForMultipleMulti(
//         [stakeA.address],
//         [owner.address, alice.address],
//         [stakeB.address]
//       );

//       expect(await insure.balanceOf(owner.address)).to.eq(parseEther("5"));
//       expect(await insure.balanceOf(alice.address)).to.eq(parseEther("0"));

//       expect(await insure.calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("10000")
//       );
//       expect((await insure.calcUnderlying()).amounts[0]).to.eq(
//         parseEther("5000")
//       );
//       expect((await insure.calcUnderlying()).amounts[1]).to.eq(
//         parseEther("25")
//       );

//       await insure.setProtocolPremiums(
//         PROTOCOL_X,
//         [tokenA.address, tokenB.address],
//         [ApremiumPerBlock, BpremiumPerBlock.mul(2)],
//         [AusdPerPremium, BusdPerPremium.mul(150).div(100)]
//       );

//       await insure
//         .connect(alice)
//         .stake(parseEther("10"), alice.address, tokenA.address);
//       await insure.activateCooldown(parseEther("0.5"), tokenA.address);

//       await mine(3);

//       // harvest
//       await insure.harvestForMultipleMulti(
//         [stakeA.address],
//         [owner.address, alice.address, insure.address],
//         [stakeB.address]
//       );

//       expect(await insure.balanceOf(owner.address)).to.eq(parseEther("10"));
//       expect(await insure.balanceOf(alice.address)).to.eq(parseEther("4"));
//       expect(await insure.balanceOf(insure.address)).to.eq(parseEther("1.6"));

//       expect(await insure.calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("25000").sub(1)
//       );

//       // 4000pb, 5 blocks = 20k / 2 = 10k
//       expect(await insure.connect(alice).calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("10000").sub(1)
//       );
//     });
//     it("Single, verify pre premium", async function () {
//       // initial setup
//       await insure.setWeights(
//         [tokenA.address, tokenB.address],
//         [parseEther("1"), parseEther("0")]
//       );
//       const ApremiumPerBlock = parseEther("1000");
//       const AusdPerPremium = parseEther("1");

//       const BpremiumPerBlock = parseEther("5");
//       const BusdPerPremium = parseEther("200");

//       await insure.stake(parseEther("10"), owner.address, tokenA.address);
//       await insure
//         .connect(alice)
//         .stake(parseEther("10"), alice.address, tokenA.address);
//       await insure
//         .connect(bob)
//         .stake(parseEther("10"), bob.address, tokenA.address);

//       const b0 = await blockNumber(
//         insure.setProtocolPremiums(
//           PROTOCOL_X,
//           [tokenA.address, tokenB.address],
//           [ApremiumPerBlock, BpremiumPerBlock],
//           [AusdPerPremium, BusdPerPremium]
//         )
//       );
//       await mine(2);

//       await insure.harvestForMultipleMulti(
//         [stakeA.address],
//         [owner.address, alice.address, bob.address, insure.address],
//         [stakeB.address]
//       );

//       expect(await insure.calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("2000")
//       );
//       expect(await insure.connect(alice).calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("2000")
//       );
//       expect(await insure.connect(bob).calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("2000")
//       );
//       expect(await insure.calcUnderlyingInStoredUSDFor(insure.address)).to.eq(
//         parseEther("0")
//       );
//     });
//     it("Single, verify pre premium", async function () {
//       // initial setup
//       await insure.setWeights(
//         [tokenA.address, tokenB.address],
//         [parseEther("1"), parseEther("0")]
//       );

//       const BpremiumPerBlock = parseEther("5");
//       const BusdPerPremium = parseEther("200");

//       await insure.stake(parseEther("10"), owner.address, tokenA.address);
//       await insure
//         .connect(alice)
//         .stake(parseEther("10"), alice.address, tokenA.address);
//       await insure
//         .connect(bob)
//         .stake(parseEther("10"), bob.address, tokenA.address);

//       // t = 0
//       b0 = await blockNumber(
//         insure.setProtocolPremiums(
//           PROTOCOL_X,
//           [tokenB.address],
//           [BpremiumPerBlock],
//           [BusdPerPremium]
//         )
//       );
//       await mine(9);

//       // t = 10
//       await insure.setProtocolPremiums(
//         PROTOCOL_X,
//         [tokenB.address],
//         [BpremiumPerBlock.mul(2)],
//         [BusdPerPremium.div(2)]
//       );

//       await mine(8);

//       const b = await blockNumber(
//         insure.activateCooldown(parseEther("1"), tokenA.address)
//       );

//       // t = 20
//       await insure.setProtocolPremiums(
//         PROTOCOL_X,
//         [tokenB.address],
//         [BpremiumPerBlock.mul(3)],
//         [BusdPerPremium.div(4)]
//       );

//       await mine(9);

//       // t = 30
//       await insure.harvestForMultipleMulti(
//         [stakeA.address],
//         [owner.address, alice.address, bob.address, insure.address],
//         [stakeB.address]
//       );
//       console.log(b0.toString(), b.toString());
//       // total 300 eth
//       // 19 blocks in
//       // 11 blocks out
//       // TODO calc right amounts for owner / isnsure
//       expect(await insure.balanceOf(owner.address)).to.eq(
//         parseEther("9.333333333333333333")
//       );
//       expect(await insure.balanceOf(alice.address)).to.eq(parseEther("20"));
//       expect(await insure.balanceOf(bob.address)).to.eq(parseEther("20"));
//       expect(await insure.balanceOf(insure.address)).to.eq(
//         parseEther("10.666666666666666667")
//       );
//       // 140 ETH * 50 = 7k / 3 = 2.3333
//       expect(await insure.calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("2333.33333333333333325")
//       );
//       // 300 ETH * 50 = 15k / 3 = 5k
//       expect(await insure.connect(alice).calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("5000")
//       );
//       expect(await insure.connect(bob).calcUnderlyingInStoredUSD()).to.eq(
//         parseEther("5000")
//       );
//       // 160 ETH * 50 = 8k / 3 = 2.6667
//       expect(await insure.calcUnderlyingInStoredUSDFor(insure.address)).to.eq(
//         parseEther("2666.66666666666666675")
//       );
//     });
//   });
// });
