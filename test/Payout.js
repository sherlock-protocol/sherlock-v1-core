const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, blockNumber, Uint16Max, Uint32Max } = require('./utilities');
const { constants } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');

describe('Payout', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);

    await prepare(this, ['ERC20Mock', 'ERC20Mock6d', 'ERC20Mock8d', 'NativeLock', 'ForeignLock']);

    await solution(this, 'sl', this.gov);
    await deploy(this, [
      ['tokenA', this.ERC20Mock, ['TokenA', 'A', parseUnits('1000', 18)]],
      ['tokenB', this.ERC20Mock6d, ['TokenB', 'B', parseUnits('1000', 6)]],
      ['tokenC', this.ERC20Mock8d, ['TokenC', 'C', parseUnits('1000', 8)]],
    ]);
    await deploy(this, [
      ['lockA', this.ForeignLock, ['Lock TokenA', 'lockA', this.sl.address, this.tokenA.address]],
      ['lockB', this.ForeignLock, ['Lock TokenB', 'lockB', this.sl.address, this.tokenB.address]],
      ['lockC', this.ForeignLock, ['Lock TokenC', 'lockC', this.sl.address, this.tokenC.address]],
    ]);

    await this.sl.c(this.gov).setMaxTokensSherX(8);
    await this.sl.c(this.gov).setMaxTokensStaker(8);
    await this.sl.c(this.gov).setMaxProtocolPool(8);

    // Add tokenA as valid token
    await this.sl
      .c(this.gov)
      .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);

    await this.sl.c(this.gov).setCooldownFee(Uint32Max, this.tokenA.address);
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
    await this.sl.c(this.gov).setWeights([this.tokenA.address], [Uint16Max], 0);

    await this.sl
      .c(this.gov)
      .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [this.tokenA.address]);

    await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);
    await this.sl.depositProtocolBalance(this.protocolX, parseEther('100'), this.tokenA.address);
    this.b0 = await blockNumber(
      this.sl
        .c(this.gov)
        ['setProtocolPremiumAndTokenPrice(bytes32,address,uint256,uint256)'](
          this.protocolX,
          this.tokenA.address,
          parseEther('1'),
          parseEther('1'),
        ),
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
      expect(await this.sl.getInternalTotalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(this.b0);

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

      expect(await this.sl.getInternalTotalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(this.b0);

      expect(await this.sl.getFirstMoneyOut(this.tokenA.address)).to.eq(parseEther('10'));
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('4'));
      expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.eq(parseEther('2'));
      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(parseEther('6'));
      expect(await this.sl.balanceOf(this.bob.address)).to.eq(parseEther('0'));
    });
  });
});

describe('Payout - SherX', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);

    await prepare(this, ['ERC20Mock', 'ERC20Mock6d', 'ERC20Mock8d', 'NativeLock', 'ForeignLock']);

    await solution(this, 'sl', this.gov);
    await deploy(this, [
      ['tokenA', this.ERC20Mock, ['TokenA', 'A', parseUnits('1000', 18)]],
      ['tokenB', this.ERC20Mock6d, ['TokenB', 'B', parseUnits('1000', 6)]],
      ['tokenC', this.ERC20Mock8d, ['TokenC', 'C', parseUnits('1000', 8)]],
      ['tokenD', this.ERC20Mock8d, ['TokenD', 'D', parseUnits('1000', 8)]],
    ]);
    await deploy(this, [
      ['lockA', this.ForeignLock, ['Lock TokenA', 'lockA', this.sl.address, this.tokenA.address]],
      ['lockB', this.ForeignLock, ['Lock TokenB', 'lockB', this.sl.address, this.tokenB.address]],
      ['lockC', this.ForeignLock, ['Lock TokenC', 'lockC', this.sl.address, this.tokenC.address]],
      ['lockD', this.ForeignLock, ['Lock TokenD', 'lockD', this.sl.address, this.tokenD.address]],
      ['lockX', this.NativeLock, ['Lock TokenX', 'lockX', this.sl.address]],
    ]);

    await this.sl.c(this.gov).setMaxTokensSherX(8);
    await this.sl.c(this.gov).setMaxTokensStaker(8);
    await this.sl.c(this.gov).setMaxProtocolPool(8);
    // Add tokenA as valid token
    await this.sl
      .c(this.gov)
      .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);

    await this.sl
      .c(this.gov)
      .tokenInit(this.tokenC.address, this.gov.address, this.lockC.address, true);

    await this.sl
      .c(this.gov)
      .tokenInit(this.sl.address, this.gov.address, this.lockX.address, false);

    await this.sl
      .c(this.gov)
      .tokenInit(this.tokenD.address, this.gov.address, constants.AddressZero, false);

    await this.sl.c(this.gov).setCooldown(1);
    await this.sl.c(this.gov).setUnstakeWindow(1);
    await this.tokenA.approve(this.sl.address, parseEther('10000'));
    await this.tokenC.approve(this.sl.address, parseUnits('10000', this.tokenC.dec));
    await this.lockA.approve(this.sl.address, parseEther('10000'));

    await this.sl
      .c(this.gov)
      .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [
        this.tokenA.address,
        this.tokenC.address,
      ]);
    await this.sl.depositProtocolBalance(this.protocolX, parseEther('100'), this.tokenA.address);
    await this.sl.depositProtocolBalance(
      this.protocolX,
      parseUnits('100', this.tokenC.dec),
      this.tokenC.address,
    );

    await this.sl
      .c(this.gov)
      ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
        this.protocolX,
        [this.tokenA.address, this.tokenC.address],
        [parseEther('1'), parseUnits('1', this.tokenC.dec)],
        [parseEther('1'), parseUnits('1', this.tokenC.usdDec)],
      );

    // unallocated
    await this.sl.c(this.gov).setWatsonsAddress(this.alice.address);
    await this.sl.c(this.gov).setInitialWeight();
    await this.sl.c(this.gov).setWeights([this.tokenA.address], [Uint16Max], 0);

    await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);
    await this.sl.activateCooldown(parseEther('1'), this.tokenA.address);

    this.b0 = await blockNumber(
      this.sl
        .c(this.gov)
        ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
          this.protocolX,
          [this.tokenA.address, this.tokenC.address],
          [parseEther('0'), parseUnits('0', this.tokenC.dec)],
          [parseEther('1'), parseUnits('1', this.tokenC.usdDec)],
        ),
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
    expect(data.amounts[1]).to.eq(parseUnits('1', this.tokenC.dec));
    expect(data.amounts.length).to.eq(2);

    expect(await this.sl.getInternalTotalSupply()).to.eq(parseEther('6'));
    expect(await this.sl.getInternalTotalSupplySettled()).to.eq(this.b0);

    // Payout balances
    expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(0);
    expect(await this.tokenC.balanceOf(this.bob.address)).to.eq(0);
  });
  describe('Not excluding', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do complete depletion', async function () {
      await expect(
        this.sl
          .c(this.gov)
          .payout(
            this.bob.address,
            [this.sl.address],
            [0],
            [parseEther('2')],
            [0],
            constants.AddressZero,
          ),
      ).to.be.revertedWith('STAKE');
    });
    it('Do premium token', async function () {
      await expect(
        this.sl
          .c(this.gov)
          .payout(this.bob.address, [this.tokenD.address], [0], [0], [0], constants.AddressZero),
      ).to.be.revertedWith('INIT');
    });
    it('Do', async function () {
      const b1 = await blockNumber(
        this.sl
          .c(this.gov)
          .payout(
            this.bob.address,
            [this.sl.address],
            [0],
            [parseEther('1')],
            [0],
            constants.AddressZero,
          ),
      );

      // Token A
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('10'));
      expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.eq(parseEther('1'));

      // SherX
      expect(await this.sl.getFirstMoneyOut(this.sl.address)).to.eq(parseEther('0'));
      expect(await this.sl.getStakersPoolBalance(this.sl.address)).to.eq(parseEther('1'));

      // SherX Data
      expect(await this.sl['calcUnderlyingInStoredUSD(uint256)'](parseEther('1'))).to.eq(
        parseEther('2'),
      );
      expect(await this.sl.getTotalSherX()).to.eq(parseEther('5'));

      const data = await this.sl['calcUnderlying(uint256)'](parseEther('1'));
      expect(data.amounts[0]).to.eq(parseEther('1'));
      expect(data.amounts[1]).to.eq(parseUnits('1', this.tokenC.dec));
      expect(data.amounts.length).to.eq(2);

      expect(await this.sl.getInternalTotalSupply()).to.eq(parseEther('5'));
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b1);

      // Payout balances
      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(parseEther('1'));
      expect(await this.tokenC.balanceOf(this.bob.address)).to.eq(parseUnits('1', this.tokenC.dec));
    });
  });
  describe('Excluding tokenC', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      const b1 = await blockNumber(
        this.sl
          .c(this.gov)
          .payout(
            this.bob.address,
            [this.sl.address],
            [0],
            [parseEther('2').sub(1)],
            [0],
            this.tokenC.address,
          ),
      );

      // Token A
      expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('10'));
      expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.eq(parseEther('1'));

      // SherX
      expect(await this.sl.getFirstMoneyOut(this.sl.address)).to.eq(parseEther('0'));
      expect(await this.sl.getStakersPoolBalance(this.sl.address)).to.eq(1);

      // SherX Data
      expect(await this.sl['calcUnderlyingInStoredUSD(uint256)'](parseEther('1'))).to.eq(
        parseEther('2').add(2000000000),
      );
      expect(await this.sl.getTotalSherX()).to.eq(parseEther('5').sub(4999999999));

      const data = await this.sl['calcUnderlying(uint256)'](parseEther('1'));
      expect(data.amounts[0]).to.eq(parseEther('0.8').add(800000000));
      expect(data.amounts[1]).to.eq(parseUnits('1.2', this.tokenC.dec));
      expect(data.amounts.length).to.eq(2);

      expect(await this.sl.getInternalTotalSupply()).to.eq(parseEther('5').sub(4999999999));
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b1);

      // Payout balances
      expect(await this.tokenA.balanceOf(this.bob.address)).to.eq(parseEther('2').sub(1));
      expect(await this.tokenC.balanceOf(this.bob.address)).to.eq(0);
    });
  });
  describe('With unpaid premium', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();

      await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);
      this.b2 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
            this.protocolX,
            [this.tokenA.address, this.tokenC.address],
            [parseEther('10'), parseUnits('10', this.tokenC.dec)],
            [parseEther('1'), parseUnits('1', this.tokenC.usdDec)],
          ),
      );
      await timeTraveler.mine(5);
      await this.sl['harvest()']();
    });
    it('Initital state', async function () {
      expect(await this.sl.LockToTokenXRate(this.sl.address)).to.eq(parseEther('2'));
      expect(await this.sl.getPremiumLastPaid(this.tokenC.address)).to.eq(this.b2);
    });
    it('Do', async function () {
      const b3 = await blockNumber(
        this.sl
          .c(this.gov)
          .payout(
            this.bob.address,
            [this.sl.address],
            [0],
            [parseEther('15')],
            [0],
            constants.AddressZero,
          ),
      );

      expect(await this.sl.LockToTokenXRate(this.sl.address)).to.eq(parseEther('1.0625'));
      expect(await this.sl.getPremiumLastPaid(this.tokenC.address)).to.eq(b3);
    });
  });
});

describe('Payout - Non active', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);

    await prepare(this, ['ERC20Mock', 'ERC20Mock6d', 'ERC20Mock8d', 'NativeLock', 'ForeignLock']);

    await solution(this, 'sl', this.gov);
    await deploy(this, [
      ['tokenA', this.ERC20Mock, ['TokenA', 'A', parseUnits('1000', 18)]],
      ['tokenB', this.ERC20Mock6d, ['TokenB', 'B', parseUnits('1000', 6)]],
      ['tokenC', this.ERC20Mock8d, ['TokenC', 'C', parseUnits('1000', 8)]],
    ]);
    await deploy(this, [
      ['lockA', this.ForeignLock, ['Lock TokenA', 'lockA', this.sl.address, this.tokenA.address]],
      ['lockB', this.ForeignLock, ['Lock TokenB', 'lockB', this.sl.address, this.tokenB.address]],
      ['lockC', this.ForeignLock, ['Lock TokenC', 'lockC', this.sl.address, this.tokenC.address]],
    ]);

    await this.sl.c(this.gov).setMaxTokensSherX(8);
    await this.sl.c(this.gov).setMaxTokensStaker(8);
    await this.sl.c(this.gov).setMaxProtocolPool(8);

    await this.tokenA.approve(this.sl.address, parseEther('10000'));
    await this.lockA.approve(this.sl.address, parseEther('10000'));
    // Add tokenA as valid token
    await this.sl
      .c(this.gov)
      .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, false);

    await this.sl.c(this.gov).setCooldownFee(Uint32Max.div(2), this.tokenA.address);
    await this.sl.c(this.gov).setUnstakeWindow(1);

    // first money out
    await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);
    await this.sl.activateCooldown(parseEther('1'), this.tokenA.address);
    await this.sl.unstake(0, this.bob.address, this.tokenA.address);

    await this.sl.c(this.gov).tokenDisableStakers(this.tokenA.address, 0);

    await timeTraveler.snapshot();
  });
  it('Initial state', async function () {
    expect(await this.sl.getFirstMoneyOut(this.tokenA.address)).to.be.closeTo(
      parseEther('5'),
      parseUnits('1', 10),
    );
    expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('0'));
    expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.eq(parseEther('0'));
    expect(await this.tokenA.balanceOf(this.bob.address)).to.be.closeTo(
      parseEther('5'),
      parseUnits('1', 10),
    );
    expect(await this.tokenA.balanceOf(this.carol.address)).to.eq(0);

    const stakers = await this.sl.getTokensStaker();
    expect(stakers.length).to.eq(0);

    const tokensSherX = await this.sl.getTokensSherX();
    expect(tokensSherX.length).to.eq(0);
  });
  it('Do', async function () {
    await blockNumber(
      this.sl
        .c(this.gov)
        .payout(
          this.carol.address,
          [this.tokenA.address],
          [parseEther('2')],
          [0],
          [0],
          constants.AddressZero,
        ),
    );

    expect(await this.sl.getFirstMoneyOut(this.tokenA.address)).to.be.closeTo(
      parseEther('3'),
      parseUnits('1', 10),
    );
    expect(await this.sl.getStakersPoolBalance(this.tokenA.address)).to.eq(parseEther('0'));
    expect(await this.sl.getUnallocatedSherXTotal(this.tokenA.address)).to.eq(parseEther('0'));
    expect(await this.tokenA.balanceOf(this.bob.address)).to.be.closeTo(
      parseEther('5'),
      parseUnits('1', 10),
    );
    expect(await this.tokenA.balanceOf(this.carol.address)).to.be.closeTo(
      parseEther('2'),
      parseUnits('1', 10),
    );

    const stakers = await this.sl.getTokensStaker();
    expect(stakers.length).to.eq(0);

    const tokensSherX = await this.sl.getTokensSherX();
    expect(tokensSherX.length).to.eq(0);
  });
});

describe('Payout - Using unallocated SHERX', function () {
  before(async function () {
    timeTraveler = new TimeTraveler(network.provider);

    await prepare(this, ['ERC20Mock', 'ERC20Mock6d', 'ERC20Mock8d', 'NativeLock', 'ForeignLock']);

    await solution(this, 'sl', this.gov);
    await deploy(this, [
      ['tokenA', this.ERC20Mock, ['TokenA', 'A', parseUnits('1000', 18)]],
      ['tokenB', this.ERC20Mock6d, ['TokenB', 'B', parseUnits('1000', 6)]],
      ['tokenC', this.ERC20Mock8d, ['TokenC', 'C', parseUnits('1000', 8)]],
    ]);
    await deploy(this, [
      ['lockA', this.ForeignLock, ['Lock TokenA', 'lockA', this.sl.address, this.tokenA.address]],
      ['lockB', this.ForeignLock, ['Lock TokenB', 'lockB', this.sl.address, this.tokenB.address]],
      ['lockC', this.ForeignLock, ['Lock TokenC', 'lockC', this.sl.address, this.tokenC.address]],
      ['lockX', this.NativeLock, ['Lock TokenX', 'lockX', this.sl.address]],
    ]);

    await this.sl.c(this.gov).setMaxTokensSherX(8);
    await this.sl.c(this.gov).setMaxTokensStaker(8);
    await this.sl.c(this.gov).setMaxProtocolPool(8);
    // Add tokenA as valid token
    await this.sl
      .c(this.gov)
      .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);

    await this.sl
      .c(this.gov)
      .tokenInit(this.sl.address, this.gov.address, this.lockX.address, false);

    await this.sl.c(this.gov).setCooldown(1);
    await this.sl.c(this.gov).setUnstakeWindow(1);
    await this.tokenA.approve(this.sl.address, parseEther('10000'));
    await this.tokenA.connect(this.bob).approve(this.sl.address, parseEther('10000'));
    await this.lockA.approve(this.sl.address, parseEther('10000'));
    await this.lockA.connect(this.bob).approve(this.sl.address, parseEther('10000'));

    await this.tokenA.transfer(this.bob.address, parseEther('10'));

    await this.sl
      .c(this.gov)
      .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [this.tokenA.address]);
    await this.sl.depositProtocolBalance(this.protocolX, parseEther('100'), this.tokenA.address);

    await this.sl.c(this.bob).stake(parseEther('10'), this.bob.address, this.tokenA.address);
    await this.sl.stake(parseEther('10'), this.alice.address, this.tokenA.address);

    await this.sl.c(this.gov).setWatsonsAddress(this.alice.address);
    await this.sl.c(this.gov).setInitialWeight();
    await this.sl.c(this.gov).setWeights([this.tokenA.address], [Uint16Max], 0);

    await this.sl
      .c(this.gov)
      ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
        this.protocolX,
        [this.tokenA.address],
        [parseEther('1')],
        [parseEther('1')],
      );

    await timeTraveler.mine(4);
    this.b0 = await blockNumber(
      this.sl
        .c(this.gov)
        ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
          this.protocolX,
          [this.tokenA.address],
          [parseEther('0')],
          [parseEther('1')],
        ),
    );

    await timeTraveler.snapshot();
  });
  it('Initital state', async function () {
    expect(await this.sl['getSherXBalance(address)'](this.alice.address)).to.eq(parseEther('2.5'));
    expect(
      await this.sl['getUnallocatedSherXFor(address,address)'](
        this.alice.address,
        this.tokenA.address,
      ),
    ).to.eq(parseEther('2.5'));

    expect(await this.sl['getSherXBalance(address)'](this.bob.address)).to.eq(parseEther('2.5'));
    expect(
      await this.sl['getUnallocatedSherXFor(address,address)'](
        this.bob.address,
        this.tokenA.address,
      ),
    ).to.eq(parseEther('2.5'));
  });
  it('Do', async function () {
    await this.sl['harvest()']();
    await expect(
      this.sl
        .c(this.gov)
        .payout(
          this.carol.address,
          [this.tokenA.address],
          [0],
          [0],
          [parseEther('2.5')],
          constants.AddressZero,
        ),
    ).to.be.revertedWith('NO_UNALLOC');
    await this.sl.c(this.bob)['harvest()']();
  });
});
