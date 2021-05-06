const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, blockNumber } = require('./utilities');
const { constants } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');

describe('SherX', function () {
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
    // Add tokenA as valid token
    await this.sl
      .c(this.gov)
      .tokenAdd(this.tokenA.address, this.lockA.address, this.gov.address, false);

    await this.tokenA.approve(this.sl.address, parseEther('10000'));
    await timeTraveler.snapshot();
  });
  describe('setInitialWeight()', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do invalid', async function () {
      await expect(this.sl.c(this.gov).setInitialWeight(this.tokenB.address)).to.be.revertedWith(
        'SET',
      );
    });
    it('Do disabled', async function () {
      await expect(this.sl.c(this.gov).setInitialWeight(this.tokenA.address)).to.be.revertedWith(
        'DISABLED',
      );
      await this.sl.c(this.gov).setStake(true, this.tokenA.address);
    });
    it('Do', async function () {
      expect(await this.sl.getSherXWeight(this.tokenA.address)).to.eq(0);
      await this.sl.c(this.gov).setInitialWeight(this.tokenA.address);
      expect(await this.sl.getSherXWeight(this.tokenA.address)).to.eq(parseEther('1'));
    });
    it('Do twice', async function () {
      await expect(this.sl.c(this.gov).setInitialWeight(this.tokenA.address)).to.be.revertedWith(
        'ALREADY_INIT',
      );
    });
  });
  describe('setWeights()', function () {
    // LibSherX.accrueSherX() returns without changing storage in these tests
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        .tokenAdd(this.tokenB.address, this.lockB.address, this.gov.address, false);
      await this.sl.c(this.gov).setStake(true, this.tokenA.address);
      await this.sl.c(this.gov).setInitialWeight(this.tokenA.address);
    });
    it('Initial state', async function () {
      expect(await this.sl.getSherXWeight(this.tokenA.address)).to.eq(parseEther('1'));
    });
    it('Do', async function () {
      await this.sl.c(this.gov).setWeights([this.tokenA.address], [parseEther('1')]);

      expect(await this.sl.getSherXWeight(this.tokenA.address)).to.eq(parseEther('1'));
    });
    it('Do disabled', async function () {
      await expect(
        this.sl.c(this.gov).setWeights([this.tokenB.address], [parseEther('1')]),
      ).to.be.revertedWith('DISABLED');
    });
    it('Do wrong', async function () {
      await expect(
        this.sl.c(this.gov).setWeights([this.tokenC.address], [parseEther('1')]),
      ).to.be.revertedWith('INIT');
    });
    it('Do tokenB, exceed sum', async function () {
      await this.sl.c(this.gov).setStake(true, this.tokenB.address);

      await expect(
        this.sl
          .c(this.gov)
          .setWeights(
            [this.tokenA.address, this.tokenB.address],
            [parseEther('0.5'), parseEther('0.51')],
          ),
      ).to.be.revertedWith('SUM');
    });
    it('Do tokenB, beneath sum', async function () {
      await expect(
        this.sl
          .c(this.gov)
          .setWeights(
            [this.tokenA.address, this.tokenB.address],
            [parseEther('0.5'), parseEther('0.49')],
          ),
      ).to.be.revertedWith('SUM');
    });
    it('Do tokenB, single', async function () {
      await expect(
        this.sl
          .c(this.gov)
          .setWeights(
            [this.tokenB.address],
            [parseEther('1')],
          ),
      ).to.be.revertedWith('SUM');
    });
    it('Do 30/70', async function () {
      await this.sl
        .c(this.gov)
        .setWeights(
          [this.tokenA.address, this.tokenB.address],
          [parseEther('0.3'), parseEther('0.7')],
        );

      expect(await this.sl.getSherXWeight(this.tokenA.address)).to.eq(parseEther('0.3'));
      expect(await this.sl.getSherXWeight(this.tokenB.address)).to.eq(parseEther('0.7'));
    });
  });
});
