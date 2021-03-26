const { expect } = require("chai");
const { utils } = require("ethers/lib");
const { parseEther, parseUnits } = require("ethers/lib/utils");
const { constants } = require("ethers");
const { insurance } = require("./utils.js");

const PROTOCOL_X =
  "0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c7";

const NON_TOKEN = "0x09ab1303d3ccaf5f018cd511146b07a240c70294";
const NON_PROTOCOL =
  "0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c8";
const NON_PROTOCOL2 =
  "0x561ca898cce9f021c15a441ef41899706e923541cee724530075d1a1144761c9";

describe("static tests", function () {
  before(async function () {
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
    await tokenA.approve(insure.address, constants.MaxUint256);

    const Stake = await ethers.getContractFactory("Stake");
    [stakeA, stakeB, stakeC] = [
      await Stake.deploy("Stake TokenA", "stkA"),
      await Stake.deploy("Stake TokenB", "stkB"),
      await Stake.deploy("Stake TokenC", "stkC"),
    ];
    await stakeA.approve(insure.address, constants.MaxUint256);
    await stakeA.transferOwnership(insure.address);
    await stakeC.transferOwnership(insure.address);

    await insure.tokenAdd(tokenA.address, stakeA.address, owner.address);
    await insure.protocolAdd(PROTOCOL_X, owner.address, owner.address);
  });
  describe("Pool ─ State Changing", function () {
    describe("depositProtocolBalance()", function () {
      it("Invalid protocol", async function () {
        await expect(
          insure.depositProtocolBalance(
            NON_PROTOCOL,
            parseEther("1"),
            tokenA.address
          )
        ).to.be.revertedWith("PROTOCOL");
      });
      it("Invalid protocol (zero) ", async function () {
        await expect(
          insure.depositProtocolBalance(
            constants.HashZero,
            parseEther("1"),
            tokenA.address
          )
        ).to.be.revertedWith("PROTOCOL");
      });
      it("Invalid amount (zero)", async function () {
        await expect(
          insure.depositProtocolBalance(PROTOCOL_X, 0, tokenA.address)
        ).to.be.revertedWith("AMOUNT");
      });
      it("Invalid token", async function () {
        await expect(
          insure.depositProtocolBalance(PROTOCOL_X, parseEther("1"), NON_TOKEN)
        ).to.be.revertedWith("INVALID_TOKEN");
      });
      it("Invalid token (zero)", async function () {
        await expect(
          insure.depositProtocolBalance(
            PROTOCOL_X,
            parseEther("1"),
            constants.AddressZero
          )
        ).to.be.revertedWith("INVALID_TOKEN");
      });
      it("Success", async function () {
        await insure.depositProtocolBalance(
          PROTOCOL_X,
          parseEther("1"),
          tokenA.address
        );
        // TODO assert events
      });
    });
    describe("withdrawProtocolBalance()", function () {
      it("Invalid sender", async function () {
        await expect(
          insure
            .connect(alice)
            .withdrawProtocolBalance(
              PROTOCOL_X,
              parseEther("1"),
              owner.address,
              tokenA.address
            )
        ).to.be.revertedWith("SENDER");
      });
      it("Invalid protocol", async function () {
        await expect(
          insure.withdrawProtocolBalance(
            NON_PROTOCOL,
            parseEther("1"),
            owner.address,
            tokenA.address
          )
        ).to.be.revertedWith("SENDER");
      });
      it("Invalid protocol (zero)", async function () {
        await expect(
          insure.withdrawProtocolBalance(
            constants.HashZero,
            parseEther("1"),
            owner.address,
            tokenA.address
          )
        ).to.be.revertedWith("SENDER");
      });
      it("Invalid amount (zero)", async function () {
        await expect(
          insure.withdrawProtocolBalance(
            PROTOCOL_X,
            0,
            owner.address,
            tokenA.address
          )
        ).to.be.revertedWith("AMOUNT");
      });
      it("Invalid receiver (zero)", async function () {
        await expect(
          insure.withdrawProtocolBalance(
            PROTOCOL_X,
            parseEther("1"),
            constants.AddressZero,
            tokenA.address
          )
        ).to.be.revertedWith("RECEIVER");
      });
      it("Invalid token", async function () {
        await expect(
          insure.withdrawProtocolBalance(
            PROTOCOL_X,
            parseEther("1"),
            owner.address,
            NON_TOKEN
          )
        ).to.be.revertedWith("INVALID_TOKEN");
      });
      it("Invalid token (zero)", async function () {
        await expect(
          insure.withdrawProtocolBalance(
            PROTOCOL_X,
            parseEther("1"),
            owner.address,
            constants.AddressZero
          )
        ).to.be.revertedWith("INVALID_TOKEN");
      });
      it("Success", async function () {
        await insure.withdrawProtocolBalance(
          PROTOCOL_X,
          parseEther("0.5"),
          owner.address,
          tokenA.address
        );
        // TODO assert events
      });
    });
    describe("removeProtocol()", function () {
      it("Invalid sender", async function () {
        await expect(
          insure
            .connect(alice)
            .removeProtocol(PROTOCOL_X, 0, false, owner.address, tokenA.address)
        ).to.be.revertedWith("SENDER");
      });
      it("Invalid protocol", async function () {
        await expect(
          insure.removeProtocol(
            NON_PROTOCOL,
            0,
            false,
            owner.address,
            tokenA.address
          )
        ).to.be.revertedWith("INDEX");
      });
      it("Invalid protocol (zero)", async function () {
        await expect(
          insure.removeProtocol(
            constants.HashZero,
            0,
            false,
            owner.address,
            tokenA.address
          )
        ).to.be.revertedWith("INDEX");
      });
      it("Invalid index", async function () {
        await expect(
          insure.removeProtocol(
            PROTOCOL_X,
            1,
            false,
            owner.address,
            tokenA.address
          )
        ).to.be.reverted;
      });
      it("Invalid receiver (zero)", async function () {
        await expect(
          insure.removeProtocol(
            PROTOCOL_X,
            0,
            false,
            constants.AddressZero,
            tokenA.address
          )
        ).to.be.revertedWith("ADDRESS");
      });
      it("Invalid token", async function () {
        await expect(
          insure.removeProtocol(PROTOCOL_X, 0, false, owner.address, NON_TOKEN)
        ).to.be.revertedWith("INVALID_TOKEN");
      });
      it("Invalid token (zero)", async function () {
        await expect(
          insure.removeProtocol(
            PROTOCOL_X,
            0,
            false,
            owner.address,
            constants.AddressZero
          )
        ).to.be.revertedWith("INVALID_TOKEN");
      });
      it("Success", async function () {
        await insure.removeProtocol(
          PROTOCOL_X,
          0,
          false,
          owner.address,
          tokenA.address
        );
        // TODO assert events
      });
    });
    describe("payOffDebtAll()", function () {
      it("Invalid token", async function () {
        await expect(insure.payOffDebtAll(NON_TOKEN)).to.be.revertedWith(
          "INVALID_TOKEN"
        );
      });
      it("Invalid token (zero)", async function () {
        await expect(
          insure.payOffDebtAll(constants.AddressZero)
        ).to.be.revertedWith("INVALID_TOKEN");
      });
      it("Success", async function () {
        await insure.payOffDebtAll(tokenA.address);
        // TODO assert events
      });
    });
    describe("stake()", function () {
      it("Invalid amount (zero)", async function () {
        await expect(
          insure.stake(0, owner.address, tokenA.address)
        ).to.be.revertedWith("AMOUNT");
      });
      it("Invalid receiver (zero)", async function () {
        await expect(
          insure.stake(parseEther("1"), constants.AddressZero, tokenA.address)
        ).to.be.revertedWith("RECEIVER");
      });
      it("Invalid token", async function () {
        await expect(
          insure.stake(parseEther("1"), owner.address, NON_TOKEN)
        ).to.be.revertedWith("INVALID_TOKEN");
      });
      it("Invalid token (zero)", async function () {
        await expect(
          insure.stake(parseEther("1"), owner.address, constants.AddressZero)
        ).to.be.revertedWith("INVALID_TOKEN");
      });
      it("Success", async function () {
        await insure.stake(parseEther("1"), owner.address, tokenA.address);
        // todo assert events
      });
    });
    describe("withdrawStake()", function () {
      it("Invalid sender", async function () {
        await expect(
          insure.connect(alice).withdrawStake(parseEther("0.5"), tokenA.address)
        ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
      });
      it("Invalid amount (zero)", async function () {
        await expect(
          insure.withdrawStake(0, tokenA.address)
        ).to.be.revertedWith("AMOUNT");
      });
      it("Invalid token", async function () {
        await expect(
          insure.withdrawStake(parseEther("0.5"), NON_TOKEN)
        ).to.be.revertedWith("INVALID_TOKEN");
      });
      it("Invalid token (zero)", async function () {
        await expect(
          insure.withdrawStake(parseEther("0.5"), constants.AddressZero)
        ).to.be.revertedWith("INVALID_TOKEN");
      });
      it("Success", async function () {
        await insure.withdrawStake(parseEther("0.5"), tokenA.address);
        // todo assert events
      });
    });
    describe("withdrawCancel()", function () {
      it("Invalid sender", async function () {
        await expect(insure.connect(alice).withdrawCancel(0, tokenA.address)).to
          .be.reverted;
      });
      it("Invalid id", async function () {
        await expect(insure.withdrawCancel(1, tokenA.address)).to.be.reverted;
      });
      it("Invalid token", async function () {
        await expect(insure.withdrawCancel(1, NON_TOKEN)).to.be.revertedWith(
          "INVALID_TOKEN"
        );
      });
      it("Invalid token (zero)", async function () {
        await expect(
          insure.withdrawCancel(1, constants.AddressZero)
        ).to.be.revertedWith("INVALID_TOKEN");
      });
      // Requires more state
      it("Success", async function () {
        await expect(
          insure.withdrawCancel(0, tokenA.address)
        ).to.be.revertedWith("TIMELOCK_EXPIRED");
        // todo assert events
      });
    });
    describe("withdrawPurge()", function () {
      it("Invalid account", async function () {
        await expect(insure.withdrawPurge(alice.address, 0, tokenA.address)).to
          .be.reverted;
      });
      it("Invalid account (zero)", async function () {
        await expect(
          insure.withdrawPurge(constants.AddressZero, 0, tokenA.address)
        ).to.be.reverted;
      });
      it("Invalid id", async function () {
        await expect(insure.withdrawPurge(owner.address, 1, tokenA.address)).to
          .be.reverted;
      });
      it("Invalid token", async function () {
        await expect(
          insure.withdrawPurge(owner.address, 0, NON_TOKEN)
        ).to.be.revertedWith("INVALID_TOKEN");
      });
      it("Invalid token (zero)", async function () {
        await expect(
          insure.withdrawPurge(owner.address, 0, constants.AddressZero)
        ).to.be.revertedWith("INVALID_TOKEN");
      });
      it("Success", async function () {
        await expect(
          insure.withdrawPurge(owner.address, 0, tokenA.address)
        ).to.be.revertedWith("CLAIMPERIOD_NOT_EXPIRED");
      });
    });
    describe("withdrawClaim()", function () {
      it("Invalid sender", async function () {
        await expect(insure.connect(alice).withdrawClaim(0, tokenA.address)).to
          .be.reverted;
      });
      it("Invalid id", async function () {
        await expect(insure.withdrawClaim(1, tokenA.address)).to.be.reverted;
      });
      it("Invalid token", async function () {
        await expect(insure.withdrawClaim(0, NON_TOKEN)).to.be.revertedWith(
          "INVALID_TOKEN"
        );
      });
      it("Invalid token (zero)", async function () {
        await expect(
          insure.withdrawClaim(0, constants.AddressZero)
        ).to.be.revertedWith("INVALID_TOKEN");
      });
      it("Success", async function () {
        await expect(
          insure.withdrawClaim(0, tokenA.address)
        ).to.be.revertedWith("CLAIMPERIOD_EXPIRED");
      });
    });
  });
  describe("Pool ─ View Methods", function () {
    describe("getGovPool()", function () {});
    describe("isInitialized()", function () {});
    describe("isDeposit()", function () {});
    describe("getProtocolBalance()", function () {});
    describe("getProtocolPremium()", function () {});
    describe("getStakeToken()", function () {});
    describe("isProtocol()", function () {});
    describe("getProtocols()", function () {});
    describe("getAccruedDebt()", function () {});
    describe("getTotalAccruedDebt()", function () {});
    describe("getWithdrawal()", function () {});
    describe("getTotalPremiumPerBlock()", function () {});
    describe("getPremiumLastPaid()", function () {});
    describe("getWithdrawalSize()", function () {});
    describe("getWithrawalInitialIndex()", function () {});
    describe("getStakersTVL()", function () {});
    describe("getStakerTVL()", function () {});
    describe("exchangeRate()", function () {});
  });
  describe("Gov ─ State Changing", function () {
    describe("setInitialGovInsurance()", function () {
      it("Invalid sender", async function () {
        await expect(
          insure.connect(alice).setInitialGovInsurance(owner.address)
        ).to.be.revertedWith("NOT_OWNER");
      });
      it("Invalid gov", async function () {
        await expect(
          insure.setInitialGovInsurance(constants.AddressZero)
        ).to.be.revertedWith("ZERO_GOV");
      });
      it("Success", async function () {
        await expect(
          insure.setInitialGovInsurance(owner.address)
        ).to.be.revertedWith("ALREADY_SET");
      });
    });
    describe("transferGovInsurance()", function () {
      it("Invalid sender", async function () {
        await expect(
          insure.connect(alice).transferGovInsurance(owner.address)
        ).to.be.revertedWith("NOT_GOV");
      });
      it("Invalid gov", async function () {
        await expect(
          insure.transferGovInsurance(constants.AddressZero)
        ).to.be.revertedWith("ZERO_GOV");
      });
      it("Invalid gov (same)", async function () {
        await expect(
          insure.transferGovInsurance(owner.address)
        ).to.be.revertedWith("SAME_GOV");
      });
      it("Success", async function () {
        await insure.transferGovInsurance(alice.address);
        await insure.connect(alice).transferGovInsurance(owner.address);
      });
    });
    describe("setClaimPeriod()", function () {
      it("Invalid sender", async function () {
        await expect(
          insure.connect(alice).setClaimPeriod(1)
        ).to.be.revertedWith("NOT_GOV");
      });
      it("Success", async function () {
        await insure.setClaimPeriod(1);
      });
    });
    describe("setTimeLock()", function () {
      it("Invalid sender", async function () {
        await expect(insure.connect(alice).setTimeLock(1)).to.be.revertedWith(
          "NOT_GOV"
        );
      });
      it("Success", async function () {
        await insure.setTimeLock(1);
      });
    });
    describe("protocolAdd()", function () {
      it("Invalid sender", async function () {
        await expect(
          insure
            .connect(alice)
            .protocolAdd(NON_PROTOCOL, owner.address, owner.address)
        ).to.be.revertedWith("NOT_GOV");
      });
      it("Invalid protocol", async function () {
        await expect(
          insure.protocolAdd(PROTOCOL_X, owner.address, owner.address)
        ).to.be.revertedWith("COVERED");
      });
      it("Invalid protocol (zero)", async function () {
        await expect(
          insure.protocolAdd(constants.HashZero, owner.address, owner.address)
        ).to.be.revertedWith("ZERO_PROTOCOL");
      });
      it("Invalid agent (zero)", async function () {
        await expect(
          insure.protocolAdd(NON_PROTOCOL, constants.AddressZero, owner.address)
        ).to.be.revertedWith("ZERO_AGENT");
      });
      it("Invalid manager (zero)", async function () {
        await expect(
          insure.protocolAdd(NON_PROTOCOL, owner.address, constants.AddressZero)
        ).to.be.revertedWith("ZERO_MANAGER");
      });
      it("Success", async function () {
        await insure.protocolAdd(NON_PROTOCOL, owner.address, owner.address);
      });
    });
    describe("protocolUpdate()", function () {
      it("Invalid sender", async function () {
        await expect(
          insure
            .connect(alice)
            .protocolUpdate(PROTOCOL_X, owner.address, owner.address)
        ).to.be.revertedWith("NOT_GOV");
      });
      it("Invalid protocol", async function () {
        await expect(
          insure.protocolUpdate(NON_PROTOCOL2, owner.address, owner.address)
        ).to.be.revertedWith("NOT_COVERED");
      });
      it("Invalid protocol (zero)", async function () {
        await expect(
          insure.protocolUpdate(
            constants.HashZero,
            owner.address,
            owner.address
          )
        ).to.be.revertedWith("ZERO_PROTOCOL");
      });
      it("Invalid agent (zero)", async function () {
        await expect(
          insure.protocolUpdate(
            PROTOCOL_X,
            constants.AddressZero,
            owner.address
          )
        ).to.be.revertedWith("ZERO_AGENT");
      });
      it("Invalid manager (zero)", async function () {
        await expect(
          insure.protocolUpdate(
            PROTOCOL_X,
            owner.address,
            constants.AddressZero
          )
        ).to.be.revertedWith("ZERO_MANAGER");
      });
      it("Success", async function () {
        await insure.protocolUpdate(PROTOCOL_X, owner.address, owner.address);
      });
    });
    describe("protocolRemove()", function () {
      it("Invalid sender", async function () {
        await expect(
          insure.connect(alice).protocolRemove(PROTOCOL_X, owner.address)
        ).to.be.revertedWith("NOT_GOV");
      });
      it("Invalid protocol", async function () {
        await expect(
          insure.protocolRemove(NON_PROTOCOL2, owner.address)
        ).to.be.revertedWith("NOT_COVERED");
      });
      it("Invalid protocol (zero)", async function () {
        await expect(
          insure.protocolRemove(constants.HashZero, owner.address)
        ).to.be.revertedWith("NOT_COVERED");
      });
      it("Invalid receiver (zero)", async function () {
        await expect(
          insure.protocolRemove(PROTOCOL_X, constants.AddressZero)
        ).to.be.revertedWith("ZERO_RECEIVER");
      });
      it("Success", async function () {
        await insure.protocolRemove(NON_PROTOCOL, owner.address);
      });
    });
    describe("tokenAdd()", function () {
      it("Invalid sender", async function () {
        await expect(
          insure
            .connect(alice)
            .tokenAdd(tokenB.address, stakeB.address, owner.address)
        ).to.be.revertedWith("NOT_GOV");
      });
      it("Invalid token", async function () {
        await expect(
          insure.tokenAdd(tokenA.address, stakeB.address, owner.address)
        ).to.be.revertedWith("INITIALIZED");
      });
      it("Invalid token (zero)", async function () {
        await expect(
          insure.tokenAdd(constants.AddressZero, stakeB.address, owner.address)
        ).to.be.revertedWith("ZERO_TOKEN");
      });
      it("Invalid stake (zero)", async function () {
        await expect(
          insure.tokenAdd(tokenB.address, constants.AddressZero, owner.address)
        ).to.be.revertedWith("ZERO_STAKE");
      });
      it("Invalid stake (owner)", async function () {
        await expect(
          insure.tokenAdd(tokenB.address, stakeB.address, owner.address)
        ).to.be.revertedWith("OWNER");
      });
      it("Invalid govpool (zero)", async function () {
        await expect(
          insure.tokenAdd(tokenC.address, stakeC.address, constants.AddressZero)
        ).to.be.revertedWith("ZERO_GOV");
      });
    });
    describe("tokenDisable()", function () {
      it("Invalid sender", async function () {
        await expect(
          insure.connect(alice).tokenDisable(tokenA.address)
        ).to.be.revertedWith("NOT_GOV");
      });
      it("Invalid token (zero)", async function () {
        await expect(insure.tokenDisable(tokenB.address)).to.be.revertedWith(
          "NOT_INITIALIZED"
        );
      });
      it("Success", async function () {
        await insure.tokenDisable(tokenA.address);
      });
    });
    describe("tokenRemove()", function () {
      it("Invalid sender", async function () {
        await expect(
          insure.connect(alice).tokenRemove(tokenA.address, 0, owner.address)
        ).to.be.revertedWith("NOT_GOV");
      });
      it("Invalid token", async function () {
        await expect(
          insure.tokenRemove(tokenB.address, 0, owner.address)
        ).to.be.revertedWith("INDEX");
      });
      it("Invalid token (zero)", async function () {
        await expect(
          insure.tokenRemove(constants.AddressZero, 0, owner.address)
        ).to.be.revertedWith("INDEX");
      });
      it("Invalid index", async function () {
        await expect(insure.tokenRemove(tokenA.address, 1, owner.address)).to.be
          .reverted;
      });
      it("Invalid to", async function () {
        await expect(
          insure.tokenRemove(tokenA.address, 0, constants.AddressZero)
        ).to.be.revertedWith("ZERO_TO");
      });
      it("Success", async function () {
        await expect(
          insure.tokenRemove(tokenA.address, 0, owner.address)
        ).to.be.revertedWith("ACTIVE_PROTOCOLS");
      });
    });
  });
  describe("Gov ─ View Methods", function () {
    describe("getClaimPeriod()", function () {});
    describe("getTimeLock()", function () {});
    describe("getTokens()", function () {});
    describe("getProtocolIsCovered()", function () {});
    describe("getProtocolManager()", function () {});
    describe("getProtocolAgent()", function () {});
  });
  describe("Manager ─ State Changing", function () {
    describe("setProtocolPremiums()", function () {
      it("Invalid sender", async function () {
        await expect(
          insure
            .connect(alice)
            .setProtocolPremiums(PROTOCOL_X, [tokenA.address], [5])
        ).to.be.revertedWith("NOT_MANAGER");
      });
      it("Invalid protocol", async function () {
        await expect(
          insure.setProtocolPremiums(NON_PROTOCOL, [tokenA.address], [5])
        ).to.be.revertedWith("NOT_COVERED");
      });
      it("Invalid lengths", async function () {
        await expect(
          insure.setProtocolPremiums(PROTOCOL_X, [tokenA.address], [5, 4])
        ).to.be.revertedWith("LENGTH");
      });
      it("Invalid token", async function () {
        await expect(
          insure.setProtocolPremiums(PROTOCOL_X, [NON_TOKEN], [5])
        ).to.be.revertedWith("WHITELIST");
      });
      it("Success", async function () {
        await insure.setProtocolPremiums(PROTOCOL_X, [tokenA.address], [5]);
      });
    });
  });
});
