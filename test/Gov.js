const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution } = require('./utilities');
const { TimeTraveler } = require('./utilities/snapshot');

describe('Gov', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);

    await prepare(this, ['ERC20Mock', 'NativeLock', 'ForeignLock']);

    await deploy(this, [
      ['tokenA', this.ERC20Mock, ['TokenA', 'A', parseEther('1000')]],
      ['tokenB', this.ERC20Mock, ['TokenB', 'B', parseEther('1000')]],
      ['tokenC', this.ERC20Mock, ['TokenC', 'C', parseEther('1000')]],
    ]);

    await deploy(this, [
      ['stakeA', this.ERC20Mock, ['Stake TokenA', 'stkA', this.tokenA.address]],
      ['stakeB', this.ERC20Mock, ['Stake TokenB', 'stkB', this.tokenB.address]],
      ['stakeC', this.ERC20Mock, ['Stake TokenC', 'stkC', this.tokenC.address]],
    ]);

    await solution(this, 'sl', this.gov);

    await timeTraveler.snapshot();
  });
  it('Temp', async function () {});
});
