const { parseEther, parseUnits } = require("ethers/lib/utils");
const { constants } = require("ethers");
const { insurance } = require("../test/utils.js");
const hre = require("hardhat");

const PROTOCOL_1 =
  "0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c1";
const PROTOCOL_2 =
  "0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c2";
const PROTOCOL_3 =
  "0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c3";

async function main() {
  [owner, alice, bob, charlie] = await ethers.getSigners();
  [owner.address, alice.address, bob.address, charlie.address] = [
    await owner.getAddress(),
    await alice.getAddress(),
    await bob.getAddress(),
    await charlie.getAddress(),
  ];

  insure = await insurance(owner.address);
  await insure.setInitialGovInsurance(owner.address);

  // Deploying 4 tokens
  const Token = await ethers.getContractFactory("MockToken");
  const Token6d = await ethers.getContractFactory("MockTokens6d");
  const Token8d = await ethers.getContractFactory("MockTokens8d");
  [tokenDAI, tokenUSDC, tokenAAVE, tokenWETH] = [
    await Token6d.deploy("DAI token", "dai", parseEther("10000000")),
    await Token8d.deploy("USD coin", "usdc", parseEther("10000000")),
    await Token.deploy("AAVE governance", "aave", parseEther("10000000")),
    await Token.deploy("Wrapped ETH", "weth", parseEther("10000000")),
  ];

  // Deploying 4 stake tokens
  const Stake = await ethers.getContractFactory("ForeignStake");
  [stakeDAI, stakeUSDC, stakeAAVE, stakeWETH] = [
    await Stake.deploy("Stake Token DAI", "stkDAI"),
    await Stake.deploy("Stake Token USDC", "stkUSDC"),
    await Stake.deploy("Stake Token AAVE", "stkAAVE"),
    await Stake.deploy("Stake Token WETH", "stkWETH"),
  ];

  // Transfer ownership to insurance solution
  await stakeDAI.transferOwnership(insure.address);
  await stakeUSDC.transferOwnership(insure.address);
  await stakeAAVE.transferOwnership(insure.address);
  await stakeWETH.transferOwnership(insure.address);

  // Add actual tokens to the solution
  await insure.tokenAdd(tokenDAI.address, stakeDAI.address, owner.address);
  await insure.tokenAdd(tokenUSDC.address, stakeUSDC.address, owner.address);
  await insure.tokenAdd(tokenAAVE.address, stakeAAVE.address, owner.address);
  await insure.tokenAdd(tokenWETH.address, stakeWETH.address, owner.address);

  // Set withdraw variables
  await insure.setTimeLock(10);
  await insure.setClaimPeriod(5);

  // Add protocols
  await insure.protocolAdd(PROTOCOL_1, owner.address, owner.address);
  await insure.protocolAdd(PROTOCOL_2, owner.address, owner.address);
  await insure.protocolAdd(PROTOCOL_3, owner.address, owner.address);

  //
  // Function below are optional
  //

  // set premiums
  // 4 = 10 million
  await tokenDAI.approve(insure.address, constants.MaxUint256);
  await tokenUSDC.approve(insure.address, constants.MaxUint256);
  await tokenAAVE.approve(insure.address, constants.MaxUint256);
  await tokenWETH.approve(insure.address, constants.MaxUint256);
  await insure.depositProtocolBalance(
    PROTOCOL_1,
    parseEther("1"),
    tokenDAI.address
  );
  await insure.depositProtocolBalance(
    PROTOCOL_1,
    parseEther("1"),
    tokenUSDC.address
  );
  await insure.depositProtocolBalance(
    PROTOCOL_2,
    parseEther("1"),
    tokenUSDC.address
  );
  await insure.depositProtocolBalance(
    PROTOCOL_2,
    parseEther("1"),
    tokenAAVE.address
  );
  await insure.depositProtocolBalance(
    PROTOCOL_3,
    parseEther("1"),
    tokenUSDC.address
  );
  await insure.depositProtocolBalance(
    PROTOCOL_3,
    parseEther("1"),
    tokenAAVE.address
  );
  await insure.depositProtocolBalance(
    PROTOCOL_3,
    parseEther("1"),
    tokenWETH.address
  );
  //await tokenDAI.approve(insure.address, 0);
  await tokenUSDC.approve(insure.address, 0);
  await tokenAAVE.approve(insure.address, 0);
  await tokenWETH.approve(insure.address, 0);

  await insure.setProtocolPremiums(
    PROTOCOL_1,
    [tokenDAI.address, tokenUSDC.address],
    [parseUnits("4", 6), parseUnits("12", 10)]
  );
  await insure.setProtocolPremiums(
    PROTOCOL_2,
    [tokenUSDC.address, tokenAAVE.address],
    [parseUnits("0.4", 10), parseUnits("10.12", 16)]
  );
  await insure.setProtocolPremiums(
    PROTOCOL_3,
    [tokenUSDC.address, tokenAAVE.address, tokenWETH.address],
    [parseUnits("0.4", 10), parseUnits("18.12", 16), parseUnits("10.06", 16)]
  );

  // await tokenUSDC.approve(insure.address, constants.MaxUint256);
  // await tokenAAVE.approve(insure.address, constants.MaxUint256);
  // await tokenWETH.approve(insure.address, constants.MaxUint256);

  await stakeDAI.approve(insure.address, constants.MaxUint256);
  // await stakeUSDC.approve(insure.address, constants.MaxUint256);
  // await stakeAAVE.approve(insure.address, constants.MaxUint256);
  // await stakeWETH.approve(insure.address, constants.MaxUint256);

  await insure.stake(parseUnits("100", 6), owner.address, tokenDAI.address);
  // await insure.stake(parseUnits("100", 8), owner.address, tokenUSDC.address);
  // await insure.stake(parseUnits("100", 18), owner.address, tokenAAVE.address);

  await network.provider.send("evm_setAutomine", [false]);
  await network.provider.send("evm_setIntervalMining", [13325]);
  console.log("insure", insure.address);
  console.log("tokenDAI", tokenDAI.address);
  console.log("tokenUSDC", tokenUSDC.address);
  console.log("tokenAAVE", tokenAAVE.address);
  console.log("tokenWETH", tokenWETH.address);
}
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
