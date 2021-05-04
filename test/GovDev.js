const { prepare, deploy, solution } = require('./utilities');
const { TimeTraveler } = require('./utilities/snapshot');

describe('GovDev', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);

    await prepare(this, ['ERC20Mock', 'NativeLock', 'ForeignLock']);
    await solution(this, 'sl', this.gov);

    await timeTraveler.snapshot();
  });
  it('Temp', async function () {});
});
