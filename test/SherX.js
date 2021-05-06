const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, blockNumber, events } = require('./utilities');
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
      ['lockX', this.NativeLock, ['Lock TokenX', 'lockX', this.sl.address]],
    ]);
    // Add tokenA as valid token
    await this.sl
      .c(this.gov)
      .tokenAdd(this.tokenA.address, this.lockA.address, this.gov.address, false);

    await this.sl.c(this.gov).tokenAdd(this.sl.address, this.lockX.address, this.gov.address, true);

    await this.sl
      .c(this.gov)
      .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [this.tokenA.address]);

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
        this.sl.c(this.gov).setWeights([this.tokenB.address], [parseEther('1')]),
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
  describe('harvestFor(address,address)', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl.c(this.gov).setStake(true, this.tokenA.address);
      await this.sl.c(this.gov).setInitialWeight(this.tokenA.address);
    });
    it('Initial state', async function () {
      await this.sl['harvestFor(address,address)'](this.alice.address, this.lockA.address);

      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getUnallocatedSherXFor(this.alice.address, this.tokenA.address)).to.eq(
        0,
      );
      expect(await this.sl.getFirstMoneyOut(this.tokenA.address)).to.eq(0);

      expect(await this.sl.getStakersPoolBalance(this.sl.address)).to.eq(0);
      expect(await this.sl.getFirstMoneyOut(this.sl.address)).to.eq(0);

      expect(await this.sl.getSherXLastAccrued()).to.eq(0);
      expect(await this.sl.balanceOf(this.sl.address)).to.eq(0);
      expect(await this.lockX.balanceOf(this.alice.address)).to.eq(0);

      expect(await this.sl['getSherXPerBlock()']()).to.eq(0);
    });
    it('Setup', async function () {
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);
      const b0 = await blockNumber(
        this.sl
          .c(this.gov)
          .setProtocolPremiums(
            this.protocolX,
            [this.tokenA.address],
            [parseEther('1')],
            [parseEther('1')],
          ),
      );
      expect(await this.sl.getSherXLastAccrued()).to.eq(b0);
      expect(await this.sl['getSherXPerBlock(address)'](this.tokenA.address)).to.eq(
        parseEther('1'),
      );
      expect(
        await this.sl['getSherXPerBlock(address,address)'](this.alice.address, this.tokenA.address),
      ).to.eq(parseEther('1'));
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('10'));
    });
    it('Do', async function () {
      this.b1 = await blockNumber(
        this.sl['harvestFor(address,address)'](this.alice.address, this.lockA.address),
      );

      expect(await this.sl.getSherXLastAccrued()).to.eq(this.b1);
      expect(await this.sl['getSherXPerBlock(address)'](this.tokenA.address)).to.eq(
        parseEther('1'),
      );
      expect(
        await this.sl['getSherXPerBlock(address,address)'](this.alice.address, this.tokenA.address),
      ).to.eq(parseEther('1'));

      expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getUnallocatedSherXFor(this.alice.address, this.tokenA.address)).to.eq(
        0,
      );
      expect(await this.sl.getFirstMoneyOut(this.tokenA.address)).to.eq(0);

      expect(await this.sl.getStakersPoolBalance(this.sl.address)).to.eq(parseEther('1'));
      expect(await this.sl.getFirstMoneyOut(this.sl.address)).to.eq(0);

      expect(await this.sl.balanceOf(this.sl.address)).to.eq(parseEther('1'));
      expect(await this.lockX.balanceOf(this.alice.address)).to.eq(parseEther('1'));
    });
    it('Do wait', async function () {
      await timeTraveler.mine(1);

      expect(await this.sl.getSherXLastAccrued()).to.eq(this.b1);
      expect(await this.sl['getSherXPerBlock(address)'](this.tokenA.address)).to.eq(
        parseEther('1'),
      );
      expect(
        await this.sl['getSherXPerBlock(address,address)'](this.alice.address, this.tokenA.address),
      ).to.eq(parseEther('1'));

      expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.eq(parseEther('1'));
      expect(await this.sl.getUnallocatedSherXFor(this.alice.address, this.tokenA.address)).to.eq(
        parseEther('1'),
      );
      expect(await this.sl.getFirstMoneyOut(this.tokenA.address)).to.eq(0);

      expect(await this.sl.getStakersPoolBalance(this.sl.address)).to.eq(parseEther('1'));
      expect(await this.sl.getFirstMoneyOut(this.sl.address)).to.eq(0);

      expect(await this.sl.balanceOf(this.sl.address)).to.eq(parseEther('1'));
      expect(await this.lockX.balanceOf(this.alice.address)).to.eq(parseEther('1'));
    });
    it('Do again', async function () {
      this.b2 = await blockNumber(
        this.sl['harvestFor(address,address)'](this.alice.address, this.lockA.address),
      );

      expect(await this.sl.getSherXLastAccrued()).to.eq(this.b2);
      expect(await this.sl['getSherXPerBlock(address)'](this.tokenA.address)).to.eq(
        parseEther('1'),
      );
      expect(
        await this.sl['getSherXPerBlock(address,address)'](this.alice.address, this.tokenA.address),
      ).to.eq(parseEther('1'));

      expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getUnallocatedSherXFor(this.alice.address, this.tokenA.address)).to.eq(
        0,
      );
      expect(await this.sl.getFirstMoneyOut(this.tokenA.address)).to.eq(0);

      expect(await this.sl.getStakersPoolBalance(this.sl.address)).to.eq(parseEther('3'));
      expect(await this.sl.getFirstMoneyOut(this.sl.address)).to.eq(0);

      expect(await this.sl.balanceOf(this.sl.address)).to.eq(parseEther('3'));
      expect(await this.lockX.balanceOf(this.alice.address)).to.eq(parseEther('3'));
    });
  });
  describe('harvest calls', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('harvest()', async function () {
      const tx = this.sl['harvest()']();
      await expect(tx)
        .to.emit(this.sl, 'Harvest')
        .withArgs(this.alice.address, this.lockA.address)
        .to.emit(this.sl, 'Harvest')
        .withArgs(this.alice.address, this.lockX.address);

      expect((await events(tx)).length).to.eq(2);
    });
    it('harvest(address)', async function () {
      const tx = this.sl['harvest(address)'](this.lockA.address);
      await expect(tx).to.emit(this.sl, 'Harvest').withArgs(this.alice.address, this.lockA.address);
      expect((await events(tx)).length).to.eq(1);
    });
    it('harvest(address[])', async function () {
      const tx = this.sl['harvest(address[])']([this.lockA.address]);
      await expect(tx).to.emit(this.sl, 'Harvest').withArgs(this.alice.address, this.lockA.address);
      expect((await events(tx)).length).to.eq(1);
    });
    it('harvestFor(address)', async function () {
      const tx = this.sl['harvestFor(address)'](this.alice.address);
      await expect(tx)
        .to.emit(this.sl, 'Harvest')
        .withArgs(this.alice.address, this.lockA.address)
        .to.emit(this.sl, 'Harvest')
        .withArgs(this.alice.address, this.lockX.address);
      expect((await events(tx)).length).to.eq(2);
    });
    it('harvestFor(address,address)', async function () {
      const tx = this.sl['harvestFor(address,address)'](this.alice.address, this.lockA.address);
      await expect(tx).to.emit(this.sl, 'Harvest').withArgs(this.alice.address, this.lockA.address);
      expect((await events(tx)).length).to.eq(1);
    });
    it('harvestFor(address,address[])', async function () {
      const tx = this.sl['harvestFor(address,address[])'](this.alice.address, [this.lockA.address]);
      await expect(tx).to.emit(this.sl, 'Harvest').withArgs(this.alice.address, this.lockA.address);
      expect((await events(tx)).length).to.eq(1);
    });
  });
  describe('redeem() ─ stale', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.sl.depositProtocolBalance(this.protocolX, parseEther('100'), this.tokenA.address);
      // add token b for protocol
      await this.tokenB.approve(this.sl.address, parseEther('10000'));
      await this.sl
        .c(this.gov)
        .tokenAdd(this.tokenB.address, this.lockB.address, this.gov.address, false);
      await this.sl.c(this.gov).protocolDepositAdd(this.protocolX, [this.tokenB.address]);
      await this.sl.depositProtocolBalance(this.protocolX, parseEther('100'), this.tokenB.address);

      await this.sl.c(this.gov).setStake(true, this.tokenA.address);
      await this.sl.c(this.gov).setInitialWeight(this.tokenA.address);
      // stake token A
      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);
      // send SherX tokens to token A holder
      await this.sl
        .c(this.gov)
        .setProtocolPremiums(
          this.protocolX,
          [this.tokenA.address, this.tokenB.address],
          [parseEther('1'), parseEther('2')],
          [parseEther('1'), parseEther('1')],
        );
      // stop sending to token A
      this.b0 = await blockNumber(
        this.sl
          .c(this.gov)
          .setProtocolPremiums(
            this.protocolX,
            [this.tokenA.address, this.tokenB.address],
            [parseEther('0'), parseEther('0')],
            [parseEther('1'), parseEther('1')],
          ),
      );
      // harvest SherX tokens
      await this.sl['harvestFor(address,address)'](this.alice.address, this.lockA.address);
      // unstake SherX tokens
      await this.sl.c(this.gov).setUnstakeWindow(10);
      await this.lockX.approve(this.sl.address, parseEther('10000'));
      await this.sl.activateCooldown(parseEther('1'), this.sl.address);
      await this.sl.unstake(0, this.alice.address, this.sl.address);
    });
    it('Initial state', async function () {
      // underlying variables
      expect(await this.sl.totalSupply()).to.eq(parseEther('1'));
      expect(await this.sl.balanceOf(this.alice.address)).to.eq(parseEther('1'));
      expect(await this.sl.getSherXUnderlying(this.tokenA.address)).to.eq(parseEther('1'));
      expect(await this.sl.getSherXUnderlying(this.tokenB.address)).to.eq(parseEther('2'));

      const data = await this.sl['calcUnderlying()']();
      expect(data.tokens[0]).to.eq(this.tokenA.address);
      expect(data.tokens[1]).to.eq(this.sl.address);
      expect(data.tokens[2]).to.eq(this.tokenB.address);
      expect(data.tokens.length).to.eq(3);

      expect(data.amounts[0]).to.eq(parseEther('1'));
      expect(data.amounts[1]).to.eq(0);
      expect(data.amounts[2]).to.eq(parseEther('2'));
      expect(data.amounts.length).to.eq(3);

      expect(await this.sl['calcUnderlyingInStoredUSD()']()).to.eq(parseEther('3'));

      // pool variables
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(this.b0);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(parseEther('3'));
      expect(await this.sl.getTotalUsdPool()).to.eq(parseEther('3'));
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(this.b0);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(this.b0);

      // bob
      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(0);
      expect(await this.tokenB.balanceOf(this.bob.address)).to.eq(0);
    });
    it('Do', async function () {
      const b1 = await blockNumber(this.sl.redeem(parseEther('1'), this.bob.address));

      // underlying variables
      expect(await this.sl.totalSupply()).to.eq(0);
      expect(await this.sl.balanceOf(this.alice.address)).to.eq(0);
      expect(await this.sl.getSherXUnderlying(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getSherXUnderlying(this.tokenB.address)).to.eq(0);

      const data = await this.sl['calcUnderlying()']();
      expect(data.tokens[0]).to.eq(this.tokenA.address);
      expect(data.tokens[1]).to.eq(this.sl.address);
      expect(data.tokens[2]).to.eq(this.tokenB.address);
      expect(data.tokens.length).to.eq(3);

      expect(data.amounts[0]).to.eq(0);
      expect(data.amounts[1]).to.eq(0);
      expect(data.amounts[2]).to.eq(0);
      expect(data.amounts.length).to.eq(3);

      expect(await this.sl['calcUnderlyingInStoredUSD()']()).to.eq(0);

      // pool variables
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b1);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);
      expect(await this.sl.getTotalUsdPool()).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(b1);

      // bob
      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(parseEther('1'));
      expect(await this.tokenB.balanceOf(this.bob.address)).to.eq(parseEther('2'));
    });
    // verify if calc +1 matches redeem
  });
});
