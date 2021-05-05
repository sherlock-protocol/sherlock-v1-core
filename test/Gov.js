const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, blockNumber } = require('./utilities');
const { constants } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');

describe('Gov', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);

    await prepare(this, ['ERC20Mock', 'NativeLock', 'ForeignLock']);

    await solution(this, 'sl', this.gov);
    await deploy(this, [
      ['tokenA', this.ERC20Mock, ['TokenA', 'A', parseEther('1000')]],
      ['tokenB', this.ERC20Mock, ['TokenB', 'B', parseEther('1000')]],
      ['tokenC', this.ERC20Mock, ['TokenC', 'C', parseEther('1000')]],
    ]);
    await deploy(this, [
      ['lockA', this.ForeignLock, ['Lock TokenA', 'lockA', this.sl.address, this.tokenA.address]],
      ['lockB', this.ForeignLock, ['Lock TokenB', 'lockB', this.sl.address, this.tokenB.address]],
      ['lockC', this.ForeignLock, ['Lock TokenC', 'lockC', this.sl.address, this.tokenC.address]],
    ]);

    await timeTraveler.snapshot();
  });
  describe('setInitialGovInsurance()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sl.getGovInsurance()).to.eq(this.gov.address);
    });
    it('Do', async function () {
      await expect(this.sl.c(this.gov).setInitialGovInsurance(this.gov.address)).to.be.revertedWith(
        'ALREADY_SET',
      );
    });
  });
  describe('transferGovInsurance()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sl.getGovInsurance()).to.eq(this.gov.address);
    });
    it('Do', async function () {
      await this.sl.c(this.gov).transferGovInsurance(this.alice.address);
      expect(await this.sl.getGovInsurance()).to.eq(this.alice.address);
    });
  });
  describe('setUnstakeWindow()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sl.getUnstakeWindow()).to.eq(0);
    });
    it('Do', async function () {
      await this.sl.c(this.gov).setUnstakeWindow(1);
      expect(await this.sl.getUnstakeWindow()).to.eq(1);
    });
  });
  describe('setCooldown()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Initial state', async function () {
      expect(await this.sl.getCooldown()).to.eq(0);
    });
    it('Do', async function () {
      await this.sl.c(this.gov).setCooldown(1);
      expect(await this.sl.getCooldown()).to.eq(1);
    });
  });
  describe('protocolAdd()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenAdd(this.tokenA.address, this.lockA.address, this.gov.address, true);
    });
    it('Initial state', async function () {
      expect(await this.sl.getProtocolIsCovered(this.protocolX)).to.eq(false);
      expect(await this.sl.getProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.sl.getProtocolManager(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.sl.isProtocol(this.protocolX, this.tokenA.address)).to.eq(false);
      const protocols = await this.sl.getProtocols(this.tokenA.address);
      expect(protocols.length).to.eq(0);
    });
    it('Do', async function () {
      await this.sl
        .c(this.gov)
        .protocolAdd(this.protocolX, this.alice.address, this.bob.address, [this.tokenA.address]);
      expect(await this.sl.getProtocolIsCovered(this.protocolX)).to.eq(true);
      expect(await this.sl.getProtocolAgent(this.protocolX)).to.eq(this.alice.address);
      expect(await this.sl.getProtocolManager(this.protocolX)).to.eq(this.bob.address);
      expect(await this.sl.isProtocol(this.protocolX, this.tokenA.address)).to.eq(true);
      const protocols = await this.sl.getProtocols(this.tokenA.address);
      expect(protocols.length).to.eq(1);
      expect(protocols[0]).to.eq(this.protocolX);
    });
  });
  describe('protocolUpdate()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenAdd(this.tokenA.address, this.lockA.address, this.gov.address, true);
      await this.sl
        .c(this.gov)
        .protocolAdd(this.protocolX, this.alice.address, this.bob.address, [this.tokenA.address]);
    });
    it('Do', async function () {
      await this.sl
        .c(this.gov)
        .protocolUpdate(this.protocolX, this.gov.address, this.carol.address);
      expect(await this.sl.getProtocolAgent(this.protocolX)).to.eq(this.gov.address);
      expect(await this.sl.getProtocolManager(this.protocolX)).to.eq(this.carol.address);
    });
  });
  describe('protocolDepositAdd()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenAdd(this.tokenA.address, this.lockA.address, this.gov.address, true);
      await this.sl
        .c(this.gov)
        .tokenAdd(this.tokenB.address, this.lockB.address, this.gov.address, true);
      await this.sl
        .c(this.gov)
        .protocolAdd(this.protocolX, this.alice.address, this.bob.address, [this.tokenA.address]);
    });
    it('Initial state', async function () {
      expect(await this.sl.isProtocol(this.protocolX, this.tokenB.address)).to.eq(false);
      const protocols = await this.sl.getProtocols(this.tokenB.address);
      expect(protocols.length).to.eq(0);
    });
    it('Do', async function () {
      await this.sl.c(this.gov).protocolDepositAdd(this.protocolX, [this.tokenB.address]);
      expect(await this.sl.isProtocol(this.protocolX, this.tokenB.address)).to.eq(true);
      const protocols = await this.sl.getProtocols(this.tokenB.address);
      expect(protocols.length).to.eq(1);
      expect(protocols[0]).to.eq(this.protocolX);
    });
  });
  describe('protocolRemove()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenAdd(this.tokenA.address, this.lockA.address, this.gov.address, true);
      await this.sl
        .c(this.gov)
        .protocolAdd(this.protocolX, this.alice.address, this.bob.address, [this.tokenA.address]);
      await this.sl
        .c(this.gov)
        .cleanProtocol(this.protocolX, 0, false, this.alice.address, this.tokenA.address);
    });
    it('Do', async function () {
      await this.sl.c(this.gov).protocolRemove(this.protocolX);
      expect(await this.sl.getProtocolIsCovered(this.protocolX)).to.eq(false);
      expect(await this.sl.getProtocolManager(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.sl.getProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.sl.isProtocol(this.protocolX, this.tokenA.address)).to.eq(false);
    });
  });
  describe('protocolRemove() ─ Debt', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.tokenA.approve(this.sl.address, parseEther('10000'));

      await this.sl
        .c(this.gov)
        .tokenAdd(this.tokenA.address, this.lockA.address, this.gov.address, true);
      await this.sl
        .c(this.gov)
        .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [this.tokenA.address]);
      await this.sl.depositProtocolBalance(this.protocolX, parseEther('100'), this.tokenA.address);
      t0 = await blockNumber(
        this.sl
          .c(this.gov)
          .setProtocolPremiums(
            this.protocolX,
            [this.tokenA.address],
            [parseEther('1')],
            [parseEther('1')],
          ),
      );
    });
    it('Remove fail', async function () {
      await expect(this.sl.c(this.gov).protocolRemove(this.protocolX)).to.be.revertedWith('DEBT');
    });
    it('Remove fail, not removed from pool', async function () {
      t1 = await blockNumber(
        this.sl.c(this.gov).setProtocolPremiums(this.protocolX, [this.tokenA.address], [0], [0]),
      );
      await expect(this.sl.c(this.gov).protocolRemove(this.protocolX)).to.be.revertedWith(
        'POOL_PROTOCOL',
      );
    });
    it('Remove success', async function () {
      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(0);
      await this.sl
        .c(this.gov)
        .cleanProtocol(this.protocolX, 0, true, this.bob.address, this.tokenA.address);
      await this.sl.c(this.gov).protocolRemove(this.protocolX);

      const pPaid = t1.sub(t0).mul(parseEther('1'));
      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(parseEther('100').sub(pPaid));
      expect(await this.sl.getProtocolIsCovered(this.protocolX)).to.eq(false);
      expect(await this.sl.getProtocolManager(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.sl.getProtocolAgent(this.protocolX)).to.eq(constants.AddressZero);
      expect(await this.sl.isProtocol(this.protocolX, this.tokenA.address)).to.eq(false);
    });
  });
  describe('tokenAdd()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      await this.sl
        .c(this.gov)
        .tokenAdd(this.tokenA.address, this.lockA.address, this.gov.address, true);

      const tokens = await this.sl.getTokens();
      expect(tokens.length).to.eq(1);
      expect(tokens[0]).to.eq(this.tokenA.address);

      expect(await this.sl.isInitialized(this.tokenA.address)).to.eq(true);
      expect(await this.sl.isStake(this.tokenA.address)).to.eq(true);
      expect(await this.sl.getGovPool(this.tokenA.address)).to.eq(this.gov.address);
      expect(await this.sl.getLockToken(this.tokenA.address)).to.eq(this.lockA.address);
    });
    it('Do 2', async function () {
      await this.sl
        .c(this.gov)
        .tokenAdd(this.tokenB.address, this.lockB.address, this.gov.address, false);

      const tokens = await this.sl.getTokens();
      expect(tokens.length).to.eq(2);
      expect(tokens[0]).to.eq(this.tokenA.address);
      expect(tokens[1]).to.eq(this.tokenB.address);

      expect(await this.sl.isStake(this.tokenB.address)).to.eq(false);
    });
  });
  describe('tokenDisable()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenAdd(this.tokenA.address, this.lockA.address, this.gov.address, true);
    });
    it('Do', async function () {
      await this.sl.c(this.gov).tokenDisable(this.tokenA.address);

      const tokens = await this.sl.getTokens();
      expect(tokens.length).to.eq(1);
      expect(tokens[0]).to.eq(this.tokenA.address);

      expect(await this.sl.isInitialized(this.tokenA.address)).to.eq(true);
      expect(await this.sl.isStake(this.tokenA.address)).to.eq(false);
      expect(await this.sl.getGovPool(this.tokenA.address)).to.eq(this.gov.address);
      expect(await this.sl.getLockToken(this.tokenA.address)).to.eq(this.lockA.address);
    });
  });
  describe('tokenDisable() ─ Active weight', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.sl
        .c(this.gov)
        .tokenAdd(this.tokenA.address, this.lockA.address, this.gov.address, true);
      await this.sl
        .c(this.gov)
        .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [this.tokenA.address]);
      await this.sl.c(this.gov).setInitialWeight(this.tokenA.address);
    });
    it('Do', async function () {
      await expect(this.sl.c(this.gov).tokenDisable(this.tokenA.address)).to.be.revertedWith(
        'ACTIVE_WEIGHT',
      );
    });
  });
  describe('tokenRemove()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenAdd(this.tokenA.address, this.lockA.address, this.gov.address, true);
      await this.sl.c(this.gov).tokenDisable(this.tokenA.address);
    });
    it('Do', async function () {
      await this.sl.c(this.gov).tokenRemove(this.tokenA.address, 0, this.alice.address);

      const tokens = await this.sl.getTokens();
      expect(tokens.length).to.eq(0);

      await expect(this.sl.isInitialized(this.tokenA.address)).to.be.revertedWith('INVALID_TOKEN');
    });
  });
  describe('tokenRemove() ─ Active protocol', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.sl
        .c(this.gov)
        .tokenAdd(this.tokenA.address, this.lockA.address, this.gov.address, true);
      await this.sl
        .c(this.gov)
        .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [this.tokenA.address]);
      await this.sl.c(this.gov).tokenDisable(this.tokenA.address);
    });
    it('Do', async function () {
      await expect(
        this.sl.c(this.gov).tokenRemove(this.tokenA.address, 0, this.alice.address),
      ).to.be.revertedWith('ACTIVE_PROTOCOLS');
    });
  });
  describe('tokenRemove() ─ Active premium', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.sl
        .c(this.gov)
        .tokenAdd(this.tokenA.address, this.lockA.address, this.gov.address, true);
      await this.sl
        .c(this.gov)
        .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [this.tokenA.address]);
      await this.sl
        .c(this.gov)
        .setProtocolPremiums(this.protocolX, [this.tokenA.address], [1], [1]);
    });
    it('Do', async function () {
      await expect(
        this.sl.c(this.gov).tokenRemove(this.tokenA.address, 0, this.alice.address),
      ).to.be.revertedWith('ACTIVE_PREMIUM');
    });
  });
});
