const { expect } = require('chai');
const { constants } = require('ethers');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution } = require('./utilities');

describe('Stateless', function () {
  before(async function () {
    await prepare(this, ['ERC20Mock', 'NativeLock', 'ForeignLock']);
    await solution(this, 'sl', this.gov);

    await deploy(this, [
      ['tokenA', this.ERC20Mock, ['TokenA', 'A', parseEther('1000')]],
      ['tokenB', this.ERC20Mock, ['TokenB', 'B', parseEther('1000')]],
      ['tokenC', this.ERC20Mock, ['TokenC', 'C', parseEther('1000')]],
      ['tokenDisable', this.ERC20Mock, ['TokenDis', 'Dis', parseEther('1000')]],
    ]);

    await deploy(this, [
      ['lockA', this.ForeignLock, ['Lock TokenA', 'lockA', this.sl.address, this.tokenA.address]],
      ['lockB', this.ForeignLock, ['Lock TokenB', 'lockB', this.sl.address, this.tokenB.address]],
      [
        'lockWGov',
        this.ForeignLock,
        ['Lock WGov', 'LockWGov', this.gov.address, this.tokenC.address],
      ],
      ['lockWSupply', this.NativeLock, ['Lock WSupply', 'LockWSupply', this.gov.address]],
      [
        'lockDisable',
        this.ForeignLock,
        ['Lock TokenDis', 'lockDis', this.sl.address, this.tokenDisable.address],
      ],
    ]);
    // Add tokenA as valid token
    await this.sl.c(this.gov).tokenAdd(this.tokenA.address, this.lockA.address, this.gov.address);

    // Add protocolX as valid protocol
    await this.sl
      .c(this.gov)
      .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [this.tokenA.address]);

    // Setting up tokenDisable
    await this.sl
      .c(this.gov)
      .tokenAdd(this.tokenDisable.address, this.lockDisable.address, this.gov.address);
    await this.sl.c(this.gov).tokenDisable(this.tokenDisable.address);

    // Setting up lockWSupply
    await this.lockWSupply.connect(this.gov).mint(this.gov.address, parseEther('1'));
    await this.lockWSupply.connect(this.gov).transferOwnership(this.sl.address);
  });
  describe('Gov ─ State Changing', function () {
    describe('setInitialGovInsurance()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.setInitialGovInsurance(this.gov.address)).to.be.revertedWith(
          'NOT_DEV',
        );
      });
      it('Invalid gov', async function () {
        await expect(
          this.sl.c(this.gov).setInitialGovInsurance(constants.AddressZero),
        ).to.be.revertedWith('ZERO_GOV');
      });
      it('Success', async function () {
        await expect(
          this.sl.c(this.gov).setInitialGovInsurance(this.gov.address),
        ).to.be.revertedWith('ALREADY_SET');
      });
    });
    describe('transferGovInsurance()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.transferGovInsurance(this.gov.address)).to.be.revertedWith(
          'NOT_GOV_INS',
        );
      });
      it('Invalid gov', async function () {
        await expect(
          this.sl.c(this.gov).transferGovInsurance(constants.AddressZero),
        ).to.be.revertedWith('ZERO_GOV');
      });
      it('Invalid gov (same)', async function () {
        await expect(this.sl.c(this.gov).transferGovInsurance(this.gov.address)).to.be.revertedWith(
          'SAME_GOV',
        );
      });
      it('Success', async function () {
        await this.sl.c(this.gov).transferGovInsurance(this.alice.address);
        await this.sl.transferGovInsurance(this.gov.address);
      });
    });
    describe('setUnstakeWindow()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.setUnstakeWindow(1)).to.be.revertedWith('NOT_GOV_INS');
      });
      it('Success', async function () {
        await this.sl.c(this.gov).setUnstakeWindow(1);
      });
    });
    describe('setCooldown()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.setCooldown(1)).to.be.revertedWith('NOT_GOV_INS');
      });
      it('Success', async function () {
        await this.sl.c(this.gov).setCooldown(1);
      });
    });
    describe('protocolAdd()', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl.protocolAdd(this.nonProtocol1, this.gov.address, this.gov.address, []),
        ).to.be.revertedWith('NOT_GOV_INS');
      });
      it('Invalid protocol', async function () {
        await expect(
          this.sl.c(this.gov).protocolAdd(this.protocolX, this.gov.address, this.gov.address, []),
        ).to.be.revertedWith('COVERED');
      });
      it('Invalid protocol (zero)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .protocolAdd(constants.HashZero, this.gov.address, this.gov.address, []),
        ).to.be.revertedWith('ZERO_PROTOCOL');
      });
      it('Invalid agent (zero)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .protocolAdd(this.nonProtocol1, constants.AddressZero, this.gov.address, []),
        ).to.be.revertedWith('ZERO_AGENT');
      });
      it('Invalid manager (zero)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .protocolAdd(this.nonProtocol1, this.gov.address, constants.AddressZero, []),
        ).to.be.revertedWith('ZERO_MANAGER');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .protocolAdd(this.nonProtocol1, this.gov.address, this.gov.address, [
              this.tokenB.address,
            ]),
        ).to.be.revertedWith('INIT');
      });
      it('Success', async function () {
        await this.sl
          .c(this.gov)
          .protocolAdd(this.nonProtocol1, this.gov.address, this.gov.address, [
            this.tokenA.address,
          ]);
      });
    });
    describe('protocolUpdate()', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl.protocolUpdate(this.protocolX, this.gov.address, this.gov.address),
        ).to.be.revertedWith('NOT_GOV_INS');
      });
      it('Invalid protocol', async function () {
        await expect(
          this.sl.c(this.gov).protocolUpdate(this.nonProtocol2, this.gov.address, this.gov.address),
        ).to.be.revertedWith('NOT_COVERED');
      });
      it('Invalid protocol (zero)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .protocolUpdate(constants.HashZero, this.gov.address, this.gov.address),
        ).to.be.revertedWith('ZERO_PROTOCOL');
      });
      it('Invalid agent (zero)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .protocolUpdate(this.protocolX, constants.AddressZero, this.gov.address),
        ).to.be.revertedWith('ZERO_AGENT');
      });
      it('Invalid manager (zero)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .protocolUpdate(this.protocolX, this.gov.address, constants.AddressZero),
        ).to.be.revertedWith('ZERO_MANAGER');
      });
      it('Success', async function () {
        await this.sl
          .c(this.gov)
          .protocolUpdate(this.protocolX, this.gov.address, this.gov.address);
      });
    });
    describe('protocolDepositUpdate()', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl.protocolDepositUpdate(this.protocolX, [this.tokenA.address], [true]),
        ).to.be.revertedWith('NOT_GOV_INS');
      });
      it('Invalid protocol', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .protocolDepositUpdate(this.nonProtocol2, [this.tokenA.address], [true]),
        ).to.be.revertedWith('NOT_COVERED');
      });
      it('Invalid protocol (zero)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .protocolDepositUpdate(constants.HashZero, [this.tokenA.address], [true]),
        ).to.be.revertedWith('ZERO_PROTOCOL');
      });
      it('Unequal lengths', async function () {
        await expect(
          this.sl.c(this.gov).protocolDepositUpdate(this.nonProtocol2, [this.tokenA.address], []),
        ).to.be.revertedWith('LENGTH');
      });
      it('Invalid lengths (zero)', async function () {
        await expect(
          this.sl.c(this.gov).protocolDepositUpdate(this.nonProtocol2, [], []),
        ).to.be.revertedWith('ZERO');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl.c(this.gov).protocolDepositUpdate(this.protocolX, [this.tokenB.address], [true]),
        ).to.be.revertedWith('INIT');
      });
    });
    describe('protocolRemove()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.protocolRemove(this.protocolX)).to.be.revertedWith('NOT_GOV_INS');
      });
      it('Invalid protocol', async function () {
        await expect(this.sl.c(this.gov).protocolRemove(this.nonProtocol2)).to.be.revertedWith(
          'NOT_COVERED',
        );
      });
      it('Invalid protocol (zero)', async function () {
        await expect(this.sl.c(this.gov).protocolRemove(constants.HashZero)).to.be.revertedWith(
          'NOT_COVERED',
        );
      });
      it('Success', async function () {
        await this.sl.c(this.gov).protocolRemove(this.nonProtocol1);
      });
    });
    describe('tokenAdd()', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl.tokenAdd(this.tokenB.address, this.lockB.address, this.gov.address),
        ).to.be.revertedWith('NOT_GOV_INS');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl.c(this.gov).tokenAdd(this.tokenA.address, this.lockB.address, this.gov.address),
        ).to.be.revertedWith('INITIALIZED');
      });
      it('Invalid token (zero)', async function () {
        await expect(
          this.sl.c(this.gov).tokenAdd(constants.AddressZero, this.lockB.address, this.gov.address),
        ).to.be.revertedWith('ZERO_TOKEN');
      });
      it('Invalid stake (zero)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .tokenAdd(this.tokenB.address, constants.AddressZero, this.gov.address),
        ).to.be.revertedWith('ZERO_LOCK');
      });
      it('Invalid stake (owner)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .tokenAdd(this.tokenC.address, this.lockWGov.address, this.gov.address),
        ).to.be.revertedWith('OWNER');
      });
      it('Invalid govpool (zero)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .tokenAdd(this.tokenB.address, this.lockB.address, constants.AddressZero),
        ).to.be.revertedWith('ZERO_GOV');
      });
      it('Invalid supply', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .tokenAdd(this.tokenC.address, this.lockWSupply.address, this.gov.address),
        ).to.be.revertedWith('SUPPLY');
      });
      it('Invalid underlying', async function () {
        await expect(
          this.sl.c(this.gov).tokenAdd(this.tokenB.address, this.lockA.address, this.gov.address),
        ).to.be.revertedWith('UNDERLYING');
      });
      it('Success', async function () {
        await this.sl
          .c(this.gov)
          .tokenAdd(this.tokenB.address, this.lockB.address, this.gov.address);
      });
    });
    describe('tokenDisable()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.tokenDisable(this.tokenA.address)).to.be.revertedWith('NOT_GOV_INS');
      });
      it('Invalid token (zero)', async function () {
        await expect(this.sl.c(this.gov).tokenDisable(this.tokenC.address)).to.be.revertedWith(
          'NOT_INITIALIZED',
        );
      });
      it('Disable twice', async function () {
        await expect(
          this.sl.c(this.gov).tokenDisable(this.tokenDisable.address),
        ).to.be.revertedWith('ALREADY_DISABLED');
      });
      it('Success', async function () {
        await this.sl.c(this.gov).tokenDisable(this.tokenB.address);
      });
    });
    describe('tokenRemove()', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl.tokenRemove(this.tokenA.address, 0, this.gov.address),
        ).to.be.revertedWith('NOT_GOV_INS');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl.c(this.gov).tokenRemove(this.tokenB.address, 0, this.gov.address),
        ).to.be.revertedWith('INDEX');
      });
      it('Invalid token (zero)', async function () {
        await expect(
          this.sl.c(this.gov).tokenRemove(constants.AddressZero, 0, this.gov.address),
        ).to.be.revertedWith('INDEX');
      });
      it('Invalid index', async function () {
        await expect(this.sl.c(this.gov).tokenRemove(this.tokenA.address, 1, this.gov.address)).to
          .be.reverted;
      });
      it('Invalid to', async function () {
        await expect(
          this.sl.c(this.gov).tokenRemove(this.tokenA.address, 0, constants.AddressZero),
        ).to.be.revertedWith('ZERO_TO');
      });
      it('Not disabled', async function () {
        await expect(
          this.sl.c(this.gov).tokenRemove(this.tokenA.address, 0, this.gov.address),
        ).to.be.revertedWith('DISABLE_FIRST');
      });
      it('Success', async function () {
        await this.sl.c(this.gov).tokenRemove(this.tokenB.address, 2, this.gov.address);
      });
    });
  });
  describe('Gov ─ View Methods', function () {
    describe('getGovInsurance()', function () {});
    describe('getUnstakeWindow()', function () {});
    describe('getCooldown()', function () {});
    describe('getTokens()', function () {});
    describe('getProtocolIsCovered()', function () {});
    describe('getProtocolManager()', function () {});
    describe('getProtocolAgent()', function () {});
  });
  describe('GovDev ─ State Changing', function () {
    describe('transferGovDev()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.transferGovDev(this.gov.address)).to.be.revertedWith('NOT_DEV');
      });
      it('Invalid gov (same)', async function () {
        await expect(this.sl.c(this.gov).transferGovDev(this.gov.address)).to.be.revertedWith(
          'SAME_DEV',
        );
      });
      it('Success', async function () {
        await this.sl.c(this.gov).transferGovDev(this.alice.address);
        await this.sl.transferGovDev(this.gov.address);
      });
      // it("Success (renounce)", async function () {
      //   await this.sl.c(this.gov).transferGovDev(constants.AddressZero);
      // });
    });
    describe('updateSolution()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.updateSolution([], constants.AddressZero, [])).to.be.revertedWith(
          'NOT_DEV',
        );
      });
      it('Success', async function () {
        await this.sl.c(this.gov).updateSolution([], constants.AddressZero, []);
      });
    });
  });
  describe('GovDev ─ View Methods', function () {
    describe('getGovDev()', function () {});
  });
  describe('Manager ─ State Changing', function () {
    describe('setProtocolPremiums()', function () {});
    describe('setProtocolPremium()', function () {});
  });
  describe('Manager ─ View Methods', function () {});
  describe('Payout ─ State Changing', function () {
    describe('setInitialGovPayout()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.setInitialGovPayout(this.gov.address)).to.be.revertedWith('NOT_DEV');
      });
      it('Invalid gov', async function () {
        await expect(
          this.sl.c(this.gov).setInitialGovPayout(constants.AddressZero),
        ).to.be.revertedWith('ZERO_GOV');
      });
      it('Success', async function () {
        await expect(this.sl.c(this.gov).setInitialGovPayout(this.gov.address)).to.be.revertedWith(
          'ALREADY_SET',
        );
      });
    });
    describe('transferGovPayout()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.transferGovPayout(this.gov.address)).to.be.revertedWith('NOT_GOV_INS');
      });
      it('Invalid gov', async function () {
        await expect(
          this.sl.c(this.gov).transferGovPayout(constants.AddressZero),
        ).to.be.revertedWith('ZERO_GOV');
      });
      it('Invalid gov (same)', async function () {
        await expect(this.sl.c(this.gov).transferGovPayout(this.gov.address)).to.be.revertedWith(
          'SAME_GOV',
        );
      });
      it('Success', async function () {
        await this.sl.c(this.gov).transferGovPayout(this.alice.address);
        await this.sl.c(this.gov).transferGovPayout(this.gov.address);
      });
    });
    describe('payout()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.payout(this.bob.address, [], [], [], [])).to.be.revertedWith(
          'NOT_GOV_PAY',
        );
      });
      it('Invalid payout (zero)', async function () {
        await expect(
          this.sl.c(this.gov).payout(constants.AddressZero, [], [], [], []),
        ).to.be.revertedWith('ZERO_PAY');
      });
      it('Invalid payout (this)', async function () {
        await expect(
          this.sl.c(this.gov).payout(this.sl.address, [], [], [], []),
        ).to.be.revertedWith('THIS_PAY');
      });
      it('Invalid length 1', async function () {
        await expect(
          this.sl.c(this.gov).payout(this.bob.address, [], [1], [], []),
        ).to.be.revertedWith('LENGTH_1');
      });
      it('Invalid length 2', async function () {
        await expect(
          this.sl.c(this.gov).payout(this.bob.address, [], [], [1], []),
        ).to.be.revertedWith('LENGTH_2');
      });
      it('Invalid length 3', async function () {
        await expect(
          this.sl.c(this.gov).payout(this.bob.address, [], [], [], [1]),
        ).to.be.revertedWith('LENGTH_3');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl.c(this.gov).payout(this.bob.address, [this.tokenB.address], [1], [1], [1]),
        ).to.be.revertedWith('INIT');
      });
      it('Success', async function () {
        await this.sl.c(this.gov).payout(this.bob.address, [this.tokenA.address], [0], [0], [0]);
      });
    });
  });
  describe('Payout ─ View Methods', function () {
    describe('getGovPayout()', function () {});
  });
  describe('Pool ─ State Changing', function () {
    describe('setCooldownFee()', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl.setCooldownFee(parseEther('1'), this.tokenA.address),
        ).to.be.revertedWith('NOT_GOV_INS');
      });
      it('Invalid fee', async function () {
        await expect(
          this.sl.c(this.gov).setCooldownFee(parseEther('1').add(1), this.tokenA.address),
        ).to.be.revertedWith('MAX_VALUE');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl.c(this.gov).setCooldownFee(parseEther('1'), this.tokenB.address),
        ).to.be.revertedWith('INVALID_TOKEN');
      });
      it('Success', async function () {
        await this.sl.c(this.gov).setCooldownFee(parseEther('1'), this.tokenA.address);
      });
    });
    describe('depositProtocolBalance()', function () {
      it('Invalid protocol', async function () {
        await expect(
          this.sl.depositProtocolBalance(this.nonProtocol1, 1, this.tokenA.address),
        ).to.be.revertedWith('PROTOCOL');
      });
      it('Invalid amount', async function () {
        await expect(
          this.sl.depositProtocolBalance(this.protocolX, 0, this.tokenA.address),
        ).to.be.revertedWith('AMOUNT');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl.depositProtocolBalance(this.protocolX, 1, this.tokenB.address),
        ).to.be.revertedWith('INVALID_TOKEN');
      });
      it('Invalid token (disabled)', async function () {
        await expect(
          this.sl.depositProtocolBalance(this.protocolX, 1, this.tokenDisable.address),
        ).to.be.revertedWith('NO_STAKES');
      });
      it('Success', async function () {
        await expect(
          this.sl.depositProtocolBalance(this.protocolX, 1, this.tokenA.address),
        ).to.be.revertedWith('ERC20: transfer amount exceeds allowance');
      });
    });
    describe('withdrawProtocolBalance()', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl.withdrawProtocolBalance(this.protocolX, 1, this.bob.address, this.tokenA.address),
        ).to.be.revertedWith('SENDER');
      });
      it('Invalid protocol', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .withdrawProtocolBalance(this.nonProtocol1, 1, this.bob.address, this.tokenA.address),
        ).to.be.revertedWith('SENDER');
      });
      it('Invalid amount', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .withdrawProtocolBalance(this.protocolX, 0, this.bob.address, this.tokenA.address),
        ).to.be.revertedWith('AMOUNT');
      });
      it('Invalid receiver', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .withdrawProtocolBalance(this.protocolX, 1, constants.AddressZero, this.tokenA.address),
        ).to.be.revertedWith('RECEIVER');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .withdrawProtocolBalance(this.protocolX, 1, this.bob.address, constants.AddressZero),
        ).to.be.revertedWith('INVALID_TOKEN');
      });
      it('Success', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .withdrawProtocolBalance(this.protocolX, 1, this.bob.address, this.tokenA.address),
        ).to.be.reverted;
      });
    });
    describe('stake()', function () {
      it('Invalid amount', async function () {
        await expect(this.sl.stake(0, this.bob.address, this.tokenA.address)).to.be.revertedWith(
          'AMOUNT',
        );
      });
      it('Invalid receiver', async function () {
        await expect(
          this.sl.stake(1, constants.AddressZero, this.tokenA.address),
        ).to.be.revertedWith('RECEIVER');
      });
      it('Invalid token', async function () {
        await expect(this.sl.stake(1, this.bob.address, this.tokenB.address)).to.be.revertedWith(
          'INVALID_TOKEN',
        );
      });
      it('Invalid token (disabled)', async function () {
        await expect(
          this.sl.stake(1, this.bob.address, this.tokenDisable.address),
        ).to.be.revertedWith('NO_STAKES');
      });
      it('Success', async function () {
        await expect(this.sl.stake(1, this.bob.address, this.tokenA.address)).to.be.reverted;
      });
    });
    describe('activateCooldown()', function () {
      it('Invalid amount', async function () {
        await expect(this.sl.activateCooldown(0, this.tokenA.address)).to.be.revertedWith('AMOUNT');
      });
      it('Invalid token', async function () {
        await expect(this.sl.activateCooldown(1, this.tokenB.address)).to.be.revertedWith(
          'INVALID_TOKEN',
        );
      });
      it('Success', async function () {
        await expect(
          this.sl.activateCooldown(parseEther('1'), this.tokenA.address),
        ).to.be.revertedWith('SafeMath: division by zero');
      });
    });
    describe('cancelCooldown()', function () {
      it('Invalid id', async function () {
        await expect(this.sl.cancelCooldown(0, this.tokenA.address)).to.be.reverted;
      });
      it('Invalid token', async function () {
        await expect(this.sl.cancelCooldown(0, this.tokenB.address)).to.be.revertedWith(
          'INVALID_TOKEN',
        );
      });
      it('Success', async function () {
        await expect(this.sl.cancelCooldown(0, this.tokenA.address)).to.be.reverted;
      });
    });
    describe('unstakeWindowExpiry()', function () {
      it('Invalid account/id', async function () {
        await expect(this.sl.unstakeWindowExpiry(this.alice.address, 0, this.tokenA.address)).to.be
          .reverted;
      });
      it('Invalid token', async function () {
        await expect(
          this.sl.unstakeWindowExpiry(this.alice.address, 0, this.tokenB.address),
        ).to.be.revertedWith('INVALID_TOKEN');
      });
    });
    describe('unstake()', function () {
      it('Invalid id', async function () {
        await expect(this.sl.unstake(0, this.alice.address, this.tokenA.address)).to.be.reverted;
      });
      it('Invalid receiver', async function () {
        await expect(
          this.sl.unstake(0, constants.AddressZero, this.tokenA.address),
        ).to.be.revertedWith('RECEIVER');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl.unstake(0, this.alice.address, this.tokenB.address),
        ).to.be.revertedWith('INVALID_TOKEN');
      });
      it('Success', async function () {
        await expect(this.sl.unstake(0, this.alice.address, this.tokenA.address)).to.be.reverted;
      });
    });
    describe('payOffDebtAll()', function () {
      it('Invalid token', async function () {
        await expect(this.sl.payOffDebtAll(this.tokenB.address)).to.be.revertedWith(
          'INVALID_TOKEN',
        );
      });
      it('Success', async function () {
        await this.sl.payOffDebtAll(this.tokenA.address);
      });
    });
    describe('cleanProtocol()', function () {
      it('Invalid sender', async function () {
        await expect(
          this.sl.cleanProtocol(this.protocolX, 0, false, this.bob.address, this.tokenA.address),
        ).to.be.revertedWith('NOT_GOV_INS');
      });
      it('Invalid receiver', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .cleanProtocol(this.protocolX, 0, false, constants.AddressZero, this.tokenA.address),
        ).to.be.revertedWith('RECEIVER');
      });
      it('Invalid token', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .cleanProtocol(this.protocolX, 0, false, this.bob.address, this.tokenB.address),
        ).to.be.revertedWith('INVALID_TOKEN');
      });
      it('Invalid token (zero)', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .cleanProtocol(this.protocolX, 0, false, this.bob.address, constants.AddressZero),
        ).to.be.revertedWith('INVALID_TOKEN');
      });
      it('Success', async function () {
        await expect(
          this.sl
            .c(this.gov)
            .cleanProtocol(this.protocolX, 0, false, this.bob.address, this.tokenA.address),
        ).to.be.reverted;
      });
    });
  });
  describe('Pool ─ View Methods', function () {
    describe('getCooldownFee()', function () {});
    describe('getGovPool()', function () {});
    describe('isInitialized()', function () {});
    describe('isStake()', function () {});
    describe('getProtocolBalance()', function () {});
    describe('getProtocolPremium()', function () {});
    describe('getLockToken()', function () {});
    describe('isProtocol()', function () {});
    describe('getProtocols()', function () {});
    describe('getUnstakeEntry()', function () {});
    describe('getTotalAccruedDebt()', function () {});
    describe('getFirstMoneyOut()', function () {});
    describe('getAccruedDebt()', function () {});
    describe('getTotalPremiumPerBlock()', function () {});
    describe('getPremiumLastPaid()', function () {});
    describe('getUnstakeEntrySize()', function () {});
    describe('getInitialUnstakeEntry()', function () {});
    describe('getStakersPoolBalance()', function () {});
    describe('getStakerPoolBalance()', function () {});
    describe('getUnmaterializedSherX()', function () {});
    describe('exchangeRate()', function () {});
  });
  describe('ISherX ─ State Changing', function () {
    describe('redeem()', function () {
      it('Invalid amount', async function () {
        await expect(this.sl.redeem(0, this.bob.address)).to.be.revertedWith('AMOUNT');
      });
      it('Invalid receiver', async function () {
        await expect(this.sl.redeem(1, constants.AddressZero)).to.be.revertedWith('RECEIVER');
      });
      it('Success', async function () {
        await expect(this.sl.redeem(1, this.bob.address)).to.be.revertedWith(
          'SafeMath: subtraction overflow',
        );
      });
    });
    describe('_beforeTokenTransfer()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl._beforeTokenTransfer(this.alice.address, this.bob.address, 1)).to.be
          .reverted;
      });
    });
    describe('harvest()', function () {
      it('Success', async function () {
        await this.sl['harvest()']();
      });
    });
    describe('harvest(address)', function () {
      it('Success', async function () {
        await this.sl['harvest(address)'](this.lockA.address);
      });
    });
    describe('harvest(address[])', function () {
      it('Success', async function () {
        await this.sl['harvest(address[])']([this.lockA.address, this.lockB.address]);
      });
    });
    describe('harvestFor(address)', function () {
      it('Success', async function () {
        await this.sl['harvestFor(address)'](this.bob.address);
      });
    });
    describe('harvestFor(address,address)', function () {
      it('Success', async function () {
        await this.sl['harvestFor(address,address)'](this.bob.address, this.lockA.address);
      });
    });
    describe('harvestFor(address,address[])', function () {
      it('Success', async function () {
        await this.sl['harvestFor(address,address[])'](this.bob.address, [
          this.lockA.address,
          this.lockB.address,
        ]);
      });
    });
    describe('setInitialWeight()', function () {
      it('Invalid token (zero)', async function () {
        await expect(this.sl.setInitialWeight(constants.AddressZero)).to.be.revertedWith('TOKEN');
      });
      it('Success', async function () {
        await expect(this.sl.setInitialWeight(this.tokenA.address));
      });
    });
    describe('setWeights()', function () {
      it('Invalid token', async function () {
        await expect(this.sl.setWeights([this.tokenB.address], [1])).to.be.revertedWith('INIT');
      });
      it('Invalid lengths', async function () {
        await expect(this.sl.setWeights([], [1])).to.be.revertedWith('LENGTH');
      });
      it('Success', async function () {
        await this.sl.setWeights([this.tokenA.address], [parseEther('1')]);
      });
    });
  });
  describe('ISherX ─ View Methods', function () {
    describe('calcUnderlying()', function () {});
    describe('calcUnderlying(uint256)', function () {});
    describe('calcUnderlying(address)', function () {});
    describe('calcUnderlyingInStoredUSD()', function () {});
    describe('calcUnderlyingInStoredUSD(uint256)', function () {});
  });
  describe('ISherXERC20 ─ State Changing', function () {
    describe('initializeSherXERC20()', function () {
      it('Invalid sender', async function () {
        await expect(this.sl.initializeSherXERC20('SHERX', 'SHR')).to.be.revertedWith('NOT_DEV');
      });
      it('Invalid name', async function () {
        await expect(this.sl.c(this.gov).initializeSherXERC20('', 'SHR')).to.be.revertedWith(
          'NAME',
        );
      });
      it('Invalid symbol', async function () {
        await expect(this.sl.c(this.gov).initializeSherXERC20('SHERX', '')).to.be.revertedWith(
          'SYMBOL',
        );
      });
      it('Success', async function () {
        await this.sl.c(this.gov).initializeSherXERC20('SHERX', 'SHR');
      });
    });
    describe('increaseApproval()', function () {
      it('Invalid spender', async function () {
        await expect(
          this.sl.c(this.gov).increaseApproval(constants.AddressZero, 1),
        ).to.be.revertedWith('SPENDER');
      });
      it('Invalid amount', async function () {
        await expect(
          this.sl.c(this.gov).increaseApproval(this.alice.address, 0),
        ).to.be.revertedWith('AMOUNT');
      });
      it('Success', async function () {
        await this.sl.c(this.gov).increaseApproval(this.alice.address, 1);
      });
    });
    describe('decreaseApproval()', function () {
      it('Invalid spender', async function () {
        await expect(
          this.sl.c(this.gov).decreaseApproval(constants.AddressZero, 1),
        ).to.be.revertedWith('SPENDER');
      });
      it('Invalid amount', async function () {
        await expect(
          this.sl.c(this.gov).decreaseApproval(this.alice.address, 0),
        ).to.be.revertedWith('AMOUNT');
      });
      it('Success', async function () {
        await this.sl.c(this.gov).decreaseApproval(this.alice.address, 1);
      });
    });
    // TODO test other erc20 methods
  });
  describe('ISherXERC20 ─ View Methods', function () {
    describe('name()', function () {});
    describe('symbol()', function () {});
    describe('decimals()', function () {});
  });
});
