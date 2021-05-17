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

    await this.sl
      .c(this.gov)
      .tokenAdd(this.tokenC.address, this.lockC.address, this.gov.address, true);

    // Add protocolX as valid protocol
    await this.sl
      .c(this.gov)
      .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [
        this.tokenA.address,
        this.tokenC.address,
      ]);

    await this.tokenA.approve(this.sl.address, parseEther('10000'));
    await this.tokenC.approve(this.sl.address, parseEther('10000'));
    await this.sl.depositProtocolBalance(this.protocolX, parseEther('100'), this.tokenA.address);
    await this.sl.depositProtocolBalance(this.protocolX, parseEther('100'), this.tokenC.address);

    await this.sl.c(this.gov).setWatsonsAddress(this.alice.address);
    await this.sl.c(this.gov).setInitialWeight();
    await this.sl.c(this.gov).setWeights([this.tokenA.address], [parseEther('1')], 0);
    await timeTraveler.snapshot();
  });
  describe('setPPm(bytes32,address[],uint256[])', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
      await this.sl
        .c(this.gov)
        ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
          this.protocolX,
          [this.tokenA.address, this.tokenC.address],
          [parseEther('1'), parseEther('1')],
          [parseEther('1'), parseEther('1')],
        );
      await timeTraveler.mine(4);
    });
    it('Initial state', async function () {
      expect(await this.sl['calcUnderlyingInStoredUSD(uint256)'](parseEther('1'))).to.eq(
        parseEther('2'),
      );
      expect(await this.sl.getTotalSherX()).to.eq(parseEther('4'));

      const data = await this.sl['calcUnderlying(uint256)'](parseEther('1'));
      expect(data.amounts[0]).to.eq(parseEther('1'));
      expect(data.amounts[1]).to.eq(parseEther('1'));
      expect(data.amounts.length).to.eq(2);

      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(0);
      expect(await this.tokenC.balanceOf(this.bob.address)).to.eq(0);
    });
    it('Do', async function () {
      await this.sl
        .c(this.gov)
        .payout(
          this.bob.address,
          [this.tokenA.address],
          [0],
          [0],
          [parseEther('2')],
          this.tokenC.address,
        );
    });
    it('State', async function () {
      expect(await this.sl.getTotalSherX()).to.eq(parseEther('4'));
      expect(await this.sl['calcUnderlyingInStoredUSD(uint256)'](parseEther('1'))).to.eq(
        parseEther('2'),
      );

      const data = await this.sl['calcUnderlying(uint256)'](parseEther('1'));
      expect(data.amounts[0]).to.eq(parseEther('0.75'));
      expect(data.amounts[1]).to.eq(parseEther('1.25'));
      expect(data.amounts.length).to.eq(2);

      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(parseEther('2'));
      expect(await this.tokenC.balanceOf(this.bob.address)).to.eq(0);
    });
  });
});
