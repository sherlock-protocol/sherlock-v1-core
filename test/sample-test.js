const { expect } = require("chai");
const { utils } = require("ethers/lib");
const { parseEther, parseUnits } = require("ethers/lib/utils");
const { constants } = require("ethers");
const { insurance } = require("./utils.js");

FacetCutAction = {
  Add: 0,
  Replace: 1,
  Remove: 2,
};

function getSelectors(contract) {
  const signatures = [];
  for (const key of Object.keys(contract.functions)) {
    signatures.push(utils.keccak256(utils.toUtf8Bytes(key)).substr(0, 10));
  }
  return signatures;
}

const PLACEHOLDER_PROTOCOL =
  "0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7";

describe("Greeter", function () {
  before(async function () {
    [owner, alice, bob, charlie] = await ethers.getSigners();
    [owner.address, alice.address, bob.address, charlie.address] = [
      await owner.getAddress(),
      await alice.getAddress(),
      await bob.getAddress(),
      await charlie.getAddress(),
    ];

    insure = await insurance(owner.address);

    const Token = await ethers.getContractFactory("MockToken");
    [tokenA, tokenB, tokenC] = [
      await Token.deploy("TokenA", "A", parseEther("1000")),
      await Token.deploy("TokenB", "B", parseEther("1000")),
      await Token.deploy("TokenB", "C", parseEther("1000")),
    ];
    await tokenA.approve(insure.address, constants.MaxUint256);
    await tokenB.approve(insure.address, constants.MaxUint256);
    await tokenC.approve(insure.address, constants.MaxUint256);

    const Stake = await ethers.getContractFactory("Stake");
    [stakeA, stakeB, stakeC] = [
      await Stake.deploy("Stake TokenA", "stkA"),
      await Stake.deploy("Stake TokenB", "stkB"),
      await Stake.deploy("Stake TokenB", "stkC"),
    ];
    await stakeA.approve(insure.address, constants.MaxUint256);
    await stakeB.approve(insure.address, constants.MaxUint256);
    await stakeC.approve(insure.address, constants.MaxUint256);

    await stakeA.transferOwnership(insure.address);
    await stakeB.transferOwnership(insure.address);
    await stakeC.transferOwnership(insure.address);
  });
  it("Invalid token", async function () {
    await expect(
      insure.stake(parseEther("100"), owner.address, tokenA.address)
    ).to.be.revertedWith("INVALID_TOKEN");
  });
  it("Add tokens", async function () {
    await insure.tokenAdd(tokenA.address, stakeA.address);
    await insure.tokenAdd(tokenB.address, stakeB.address);
  });
  it("Valid token 1", async function () {
    expect(await insure.exchangeRate(tokenA.address)).to.eq(parseEther("1"));
    expect(await stakeA.balanceOf(owner.address)).to.eq(0);
    await insure.stake(parseEther("100"), owner.address, tokenA.address);
    expect(await insure.exchangeRate(tokenA.address)).to.eq(parseEther("0.01"));
    expect(await stakeA.balanceOf(owner.address)).to.eq(parseEther("1"));
  });
  it("Add protocol", async function () {
    await insure.protocolAdd(
      PLACEHOLDER_PROTOCOL,
      owner.address,
      owner.address
    );
  });
  it("Set premiums", async function () {
    await insure.setProtocolPremiums(
      PLACEHOLDER_PROTOCOL,
      [tokenA.address, tokenB.address],
      [parseUnits("1", 15), parseUnits("5", 15)]
    );
  });
  it("Get premiums", async function () {
    expect(await insure.getTotalPremiumPerBlock(tokenA.address)).to.eq(
      parseUnits("1", 15)
    );
    expect(await insure.getTotalPremiumPerBlock(tokenB.address)).to.eq(
      parseUnits("5", 15)
    );
  });
  // it("Valid token 2", async function () {
  //   tx = await solution.stake(parseEther("500"), token2Address);
  //   tx = await tx.wait();
  //   expect(tx.events[0].args._token).to.eq(token2Address);
  //   expect(
  //     await solution.getStake(await owner.getAddress(), token2Address)
  //   ).to.eq(parseEther("500"));
  // });
});
