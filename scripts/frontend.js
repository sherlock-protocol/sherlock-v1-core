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
  const Stake = await ethers.getContractFactory("Stake");
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
  await insure.tokenAdd(tokenDAI.address, stakeDAI.address);
  await insure.tokenAdd(tokenUSDC.address, stakeUSDC.address);
  await insure.tokenAdd(tokenAAVE.address, stakeAAVE.address);
  await insure.tokenAdd(tokenWETH.address, stakeWETH.address);

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
  await insure.setProtocolPremiums(
    PROTOCOL_1,
    [tokenDAI.address, tokenUSDC.address],
    [parseEther("4"), parseEther("12")]
  );
  await insure.setProtocolPremiums(
    PROTOCOL_2,
    [tokenUSDC.address, tokenAAVE.address],
    [parseEther("0.4"), parseEther("0.12")]
  );
  await insure.setProtocolPremiums(
    PROTOCOL_3,
    [tokenUSDC.address, tokenAAVE.address, tokenWETH.address],
    [parseEther("0.4"), parseEther("0.12"), parseEther("0.06")]
  );

  await tokenDAI.approve(insure.address, constants.MaxUint256);
  await tokenUSDC.approve(insure.address, constants.MaxUint256);
  await tokenAAVE.approve(insure.address, constants.MaxUint256);
  await tokenWETH.approve(insure.address, constants.MaxUint256);

  await stakeDAI.approve(insure.address, constants.MaxUint256);
  await stakeUSDC.approve(insure.address, constants.MaxUint256);
  await stakeAAVE.approve(insure.address, constants.MaxUint256);
  await stakeWETH.approve(insure.address, constants.MaxUint256);

  await insure.stake(parseUnits("100", 6), owner.address, tokenDAI.address);
  await insure.stake(parseUnits("100", 8), owner.address, tokenUSDC.address);
  await insure.stake(parseUnits("100", 18), owner.address, tokenAAVE.address);

  console.log("insure", insure.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
