const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, blockNumber } = require('./utilities');
const { constants } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');

describe('Payout', function () {
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
      .tokenAdd(this.tokenA.address, this.lockA.address, this.gov.address, true);

    await this.sl.c(this.gov).setCooldownFee(parseEther('1'), this.tokenA.address);
    await this.sl.c(this.gov).setCooldown(1);
    await this.sl.c(this.gov).setUnstakeWindow(1);
    await this.tokenA.approve(this.sl.address, parseEther('10000'));
    await this.lockA.approve(this.sl.address, parseEther('10000'));

    // first money out
    await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);
    await this.sl.activateCooldown(parseEther('1'), this.tokenA.address);

    // unallocated
    await this.sl.c(this.gov).setWatsonsAddress(this.alice.address);
    await this.sl.c(this.gov).setInitialWeight();
    await this.sl.c(this.gov).setWeights([this.tokenA.address], [parseEther('1')], 0);

    await this.sl
      .c(this.gov)
      .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [this.tokenA.address]);

    await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);
    await this.sl.depositProtocolBalance(this.protocolX, parseEther('100'), this.tokenA.address);
    await this.sl
      .c(this.gov)
      ['setProtocolPremiumAndTokenPrice(bytes32,address,uint256,uint256)'](
        this.protocolX,
        this.tokenA.address,
        parseEther('1'),
        parseEther('1'),
      );
    await timeTraveler.snapshot();
  });
  it('Initital state', async function () {
    expect(await this.sl.getFirstMoneyOut(this.tokenA.address)).to.eq(parseEther('10'));
    expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('10'));
    expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.eq(parseEther('1'));
    expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(parseEther('0'));
    expect(await this.sl.balanceOf(this.bob.address)).to.eq(parseEther('0'));
  });
  describe('First Money Out', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      await this.sl
        .c(this.gov)
        .payout(
          this.bob.address,
          [this.tokenA.address],
          [parseEther('8')],
          [0],
          [0],
          constants.AddressZero,
        );

      expect(await this.sl.getFirstMoneyOut(this.tokenA.address)).to.eq(parseEther('2'));
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('10'));
      expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.eq(parseEther('2'));
      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(parseEther('8'));
      expect(await this.sl.balanceOf(this.bob.address)).to.eq(parseEther('0'));
    });
  });
  describe('Stake Balance', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      await this.sl
        .c(this.gov)
        .payout(
          this.bob.address,
          [this.tokenA.address],
          [0],
          [parseEther('6')],
          [0],
          constants.AddressZero,
        );

      expect(await this.sl.getFirstMoneyOut(this.tokenA.address)).to.eq(parseEther('10'));
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('4'));
      expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.eq(parseEther('2'));
      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(parseEther('6'));
      expect(await this.sl.balanceOf(this.bob.address)).to.eq(parseEther('0'));
    });
  });
  describe('Unallocated', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      await this.sl
        .c(this.gov)
        .payout(
          this.bob.address,
          [this.tokenA.address],
          [0],
          [0],
          [parseEther('1.5')],
          constants.AddressZero,
        );

      expect(await this.sl.getFirstMoneyOut(this.tokenA.address)).to.eq(parseEther('10'));
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('10'));
      expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.eq(parseEther('0.5'));
      // The underlying 1.5 tokenA is transferred instead of 1.5 SherX
      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(parseEther('1.5'));
      expect(await this.sl.balanceOf(this.bob.address)).to.eq(0);
    });
  });
});

describe('Payout - SherX', function () {
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
      .tokenAdd(this.tokenA.address, this.lockA.address, this.gov.address, true);

    await this.sl
      .c(this.gov)
      .tokenAdd(this.tokenC.address, this.lockC.address, this.gov.address, true);

    await this.sl.c(this.gov).tokenAdd(this.sl.address, this.lockX.address, this.gov.address, true);

    await this.sl.c(this.gov).setCooldown(1);
    await this.sl.c(this.gov).setUnstakeWindow(1);
    await this.tokenA.approve(this.sl.address, parseEther('10000'));
    await this.tokenC.approve(this.sl.address, parseEther('10000'));
    await this.lockA.approve(this.sl.address, parseEther('10000'));

    await this.sl
      .c(this.gov)
      .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [
        this.tokenA.address,
        this.tokenC.address,
      ]);
    await this.sl.depositProtocolBalance(this.protocolX, parseEther('100'), this.tokenA.address);
    await this.sl.depositProtocolBalance(this.protocolX, parseEther('100'), this.tokenC.address);

    await this.sl
      .c(this.gov)
      ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
        this.protocolX,
        [this.tokenA.address, this.tokenC.address],
        [parseEther('1'), parseEther('1')],
        [parseEther('1'), parseEther('1')],
      );

    // unallocated
    await this.sl.c(this.gov).setWatsonsAddress(this.alice.address);
    await this.sl.c(this.gov).setInitialWeight();
    await this.sl.c(this.gov).setWeights([this.tokenA.address], [parseEther('1')], 0);

    await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);
    await this.sl.activateCooldown(parseEther('1'), this.tokenA.address);

    await this.sl
      .c(this.gov)
      ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
        this.protocolX,
        [this.tokenA.address, this.tokenC.address],
        [parseEther('0'), parseEther('0')],
        [parseEther('1'), parseEther('1')],
      );

    await timeTraveler.snapshot();
  });
  it('Initital state', async function () {
    // Token A
    expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('10'));
    expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.eq(parseEther('1'));

    // SherX
    expect(await this.sl.getFirstMoneyOut(this.sl.address)).to.eq(parseEther('0'));
    expect(await this.sl.getStakersPoolBalance(this.sl.address)).to.eq(parseEther('2'));

    // SherX Data
    expect(await this.sl['calcUnderlyingInStoredUSD(uint256)'](parseEther('1'))).to.eq(
      parseEther('2'),
    );
    expect(await this.sl.getTotalSherX()).to.eq(parseEther('6'));

    const data = await this.sl['calcUnderlying(uint256)'](parseEther('1'));
    expect(data.amounts[0]).to.eq(parseEther('1'));
    expect(data.amounts[1]).to.eq(parseEther('1'));
    // this.sl.address
    expect(data.amounts[2]).to.eq(parseEther('0'));
    expect(data.amounts.length).to.eq(3);

    // Payout balances
    expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(parseEther('0'));
    expect(await this.tokenC.balanceOf(this.bob.address)).to.eq(parseEther('0'));
  });
  describe('Not excluding', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      await this.sl
        .c(this.gov)
        .payout(
          this.bob.address,
          [this.sl.address],
          [0],
          [parseEther('2')],
          [0],
          constants.AddressZero,
        );

      // Token A
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('10'));
      expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.eq(parseEther('1'));

      // SherX
      expect(await this.sl.getFirstMoneyOut(this.sl.address)).to.eq(parseEther('0'));
      expect(await this.sl.getStakersPoolBalance(this.sl.address)).to.eq(parseEther('0'));

      // SherX Data
      expect(await this.sl['calcUnderlyingInStoredUSD(uint256)'](parseEther('1'))).to.eq(
        parseEther('2'),
      );
      expect(await this.sl.getTotalSherX()).to.eq(parseEther('4'));

      const data = await this.sl['calcUnderlying(uint256)'](parseEther('1'));
      expect(data.amounts[0]).to.eq(parseEther('1'));
      expect(data.amounts[1]).to.eq(parseEther('1'));
      // this.sl.address
      expect(data.amounts[2]).to.eq(parseEther('0'));
      expect(data.amounts.length).to.eq(3);

      // Payout balances
      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(parseEther('2'));
      expect(await this.tokenC.balanceOf(this.bob.address)).to.eq(parseEther('2'));
    });
  });
  describe('Not excluding c', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      await this.sl
        .c(this.gov)
        .payout(
          this.bob.address,
          [this.sl.address],
          [0],
          [parseEther('2')],
          [0],
          this.tokenC.address,
        );

      // Token A
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('10'));
      expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.eq(parseEther('1'));

      // SherX
      expect(await this.sl.getFirstMoneyOut(this.sl.address)).to.eq(parseEther('0'));
      expect(await this.sl.getStakersPoolBalance(this.sl.address)).to.eq(parseEther('0'));

      // SherX Data
      expect(await this.sl['calcUnderlyingInStoredUSD(uint256)'](parseEther('1'))).to.eq(
        parseEther('2'),
      );
      expect(await this.sl.getTotalSherX()).to.eq(parseEther('5'));

      const data = await this.sl['calcUnderlying(uint256)'](parseEther('1'));
      expect(data.amounts[0]).to.eq(parseEther('0.8'));
      expect(data.amounts[1]).to.eq(parseEther('1.2'));
      // this.sl.address
      expect(data.amounts[2]).to.eq(parseEther('0'));
      expect(data.amounts.length).to.eq(3);

      // Payout balances
      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(parseEther('2'));
      expect(await this.tokenC.balanceOf(this.bob.address)).to.eq(parseEther('0'));
    });
  });
});
