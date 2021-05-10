const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, blockNumber } = require('./utilities');
const { constants } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');

describe('Manager - Clean', function () {
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

    // Add tokenb as valid token
    await this.sl
      .c(this.gov)
      .tokenAdd(this.tokenB.address, this.lockB.address, this.gov.address, false);

    // Add protocolX as valid protocol
    await this.sl
      .c(this.gov)
      .protocolAdd(this.protocolX, this.gov.address, this.gov.address, [
        this.tokenA.address,
        this.tokenB.address,
      ]);

    // Add protocolY as valid protocol
    await this.sl
      .c(this.gov)
      .protocolAdd(this.protocolY, this.gov.address, this.gov.address, [
        this.tokenA.address,
        this.tokenB.address,
      ]);

    await this.tokenA.approve(this.sl.address, parseEther('10000'));
    await this.tokenB.approve(this.sl.address, parseEther('10000'));
    await this.sl.depositProtocolBalance(this.protocolX, parseEther('100'), this.tokenA.address);
    await this.sl.depositProtocolBalance(this.protocolX, parseEther('100'), this.tokenB.address);
    await this.sl.depositProtocolBalance(this.protocolY, parseEther('100'), this.tokenA.address);
    await this.sl.depositProtocolBalance(this.protocolY, parseEther('100'), this.tokenB.address);
    await timeTraveler.snapshot();
  });
  it('Initial state', async function () {
    // SherX
    expect(await this.sl['getSherXPerBlock()']()).to.eq(0);
    expect(await this.sl.getSherXLastAccrued()).to.eq(0);
    expect(await this.sl.totalSupply()).to.eq(0);

    // USD
    expect(await this.sl.getTotalUsdPerBlock()).to.eq(0);
    expect(await this.sl.getTotalUsdLastSettled()).to.eq(0);
    expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

    // token A
    expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(0);
    expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(0);
    expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(0);
    expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(0);
    expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

    // token B
    expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(0);
    expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(0);
    expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(0);
    expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(0);
    expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
  });
  describe('setTokenPrice(address,uint256)', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      const b0 = await blockNumber(
        this.sl.c(this.gov)['setTokenPrice(address,uint256)'](this.tokenA.address, parseEther('1')),
      );

      // SherX
      expect(await this.sl['getSherXPerBlock()']()).to.eq(0);
      expect(await this.sl.getSherXLastAccrued()).to.eq(b0);
      expect(await this.sl.totalSupply()).to.eq(0);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(0);
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b0);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(parseEther('1'));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
    it('Do again', async function () {
      const b1 = await blockNumber(
        this.sl.c(this.gov)['setTokenPrice(address,uint256)'](this.tokenA.address, parseEther('2')),
      );

      // SherX
      expect(await this.sl['getSherXPerBlock()']()).to.eq(0);
      expect(await this.sl.getSherXLastAccrued()).to.eq(b1);
      expect(await this.sl.totalSupply()).to.eq(0);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(0);
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b1);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(parseEther('2'));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
  });
  describe('setTokenPrice(address[],uint256[])', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      const b0 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setTokenPrice(address[],uint256[])'](
            [this.tokenA.address, this.tokenB.address],
            [parseEther('1'), parseEther('2')],
          ),
      );

      // SherX
      expect(await this.sl['getSherXPerBlock()']()).to.eq(0);
      expect(await this.sl.getSherXLastAccrued()).to.eq(b0);
      expect(await this.sl.totalSupply()).to.eq(0);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(0);
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b0);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(parseEther('1'));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(parseEther('2'));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
    it('Do again', async function () {
      const b1 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setTokenPrice(address[],uint256[])'](
            [this.tokenA.address, this.tokenB.address],
            [parseEther('2'), parseEther('4')],
          ),
      );

      // SherX
      expect(await this.sl['getSherXPerBlock()']()).to.eq(0);
      expect(await this.sl.getSherXLastAccrued()).to.eq(b1);
      expect(await this.sl.totalSupply()).to.eq(0);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(0);
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b1);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(parseEther('2'));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(parseEther('4'));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
  });
  describe('setPPm(bytes32,address,uint256)', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      const b0 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremium(bytes32,address,uint256)'](
            this.protocolX,
            this.tokenA.address,
            parseEther('1'),
          ),
      );

      // SherX
      expect(await this.sl['getSherXPerBlock()']()).to.eq(0);
      expect(await this.sl.getSherXLastAccrued()).to.eq(b0);
      expect(await this.sl.totalSupply()).to.eq(0);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(0);
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b0);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(parseEther('1'));
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        parseEther('1'),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
    it('Do again', async function () {
      const b1 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremium(bytes32,address,uint256)'](
            this.protocolX,
            this.tokenA.address,
            parseEther('2'),
          ),
      );

      // SherX
      expect(await this.sl['getSherXPerBlock()']()).to.eq(0);
      expect(await this.sl.getSherXLastAccrued()).to.eq(b1);
      expect(await this.sl.totalSupply()).to.eq(0);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(0);
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b1);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(parseEther('2'));
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        parseEther('2'),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
  });
  describe('setPPm(bytes32,address[],uint256[])', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      const b0 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremium(bytes32,address[],uint256[])'](
            this.protocolX,
            [this.tokenA.address, this.tokenB.address],
            [parseEther('1'), parseEther('2')],
          ),
      );

      // SherX
      expect(await this.sl['getSherXPerBlock()']()).to.eq(0);
      expect(await this.sl.getSherXLastAccrued()).to.eq(b0);
      expect(await this.sl.totalSupply()).to.eq(0);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(0);
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b0);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(parseEther('1'));
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        parseEther('1'),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(parseEther('2'));
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(
        parseEther('2'),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
    it('Do again', async function () {
      const b1 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremium(bytes32,address[],uint256[])'](
            this.protocolX,
            [this.tokenA.address, this.tokenB.address],
            [parseEther('2'), parseEther('4')],
          ),
      );

      // SherX
      expect(await this.sl['getSherXPerBlock()']()).to.eq(0);
      expect(await this.sl.getSherXLastAccrued()).to.eq(b1);
      expect(await this.sl.totalSupply()).to.eq(0);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(0);
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b1);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(parseEther('2'));
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        parseEther('2'),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(parseEther('4'));
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(
        parseEther('4'),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
  });
  describe('setPPm(bytes32[],address[][],uint256[][])', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      const b0 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremium(bytes32[],address[][],uint256[][])'](
            [this.protocolX, this.protocolY],
            [[this.tokenA.address, this.tokenB.address], [this.tokenA.address]],
            [[parseEther('1'), parseEther('2')], [parseEther('3')]],
          ),
      );

      // SherX
      expect(await this.sl['getSherXPerBlock()']()).to.eq(0);
      expect(await this.sl.getSherXLastAccrued()).to.eq(b0);
      expect(await this.sl.totalSupply()).to.eq(0);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(0);
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b0);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(parseEther('4'));
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        parseEther('1'),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(
        parseEther('3'),
      );

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(parseEther('2'));
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(
        parseEther('2'),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
    it('Do again', async function () {
      const b1 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremium(bytes32[],address[][],uint256[][])'](
            [this.protocolX, this.protocolY],
            [[this.tokenA.address, this.tokenB.address], [this.tokenA.address]],
            [[parseEther('2'), parseEther('4')], [parseEther('6')]],
          ),
      );

      // SherX
      expect(await this.sl['getSherXPerBlock()']()).to.eq(0);
      expect(await this.sl.getSherXLastAccrued()).to.eq(b1);
      expect(await this.sl.totalSupply()).to.eq(0);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(0);
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b1);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(parseEther('8'));
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        parseEther('2'),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(
        parseEther('6'),
      );

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(parseEther('4'));
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(
        parseEther('4'),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
  });
  describe('setPPmAndTokenPrice(bytes32,address,uint256,uint256)', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      const b0 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32,address,uint256,uint256)'](
            this.protocolX,
            this.tokenA.address,
            parseEther('1'),
            parseEther('2'),
          ),
      );

      // SherX
      expect(await this.sl['getSherXPerBlock()']()).to.eq(parseEther('1'));
      expect(await this.sl.getSherXLastAccrued()).to.eq(b0);
      expect(await this.sl.totalSupply()).to.eq(0);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('2'));
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b0);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(parseEther('1'));
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(parseEther('2'));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        parseEther('1'),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
    it('Do again', async function () {
      const b1 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32,address,uint256,uint256)'](
            this.protocolX,
            this.tokenA.address,
            parseEther('2'),
            parseEther('4'),
          ),
      );

      // SherX
      // doubles as the usd pool / usd per block is equally incremented.
      // only differ is double in token amount
      expect(await this.sl['getSherXPerBlock()']()).to.eq(parseEther('2'));
      expect(await this.sl.getSherXLastAccrued()).to.eq(b1);
      expect(await this.sl.totalSupply()).to.eq(parseEther('1'));

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('8'));
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b1);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(parseEther('4'));

      // token A
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(parseEther('2'));
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(parseEther('4'));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        parseEther('2'),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
  });
  describe('setPPmAndTokenPrice(bytes32,address[],uint256[],uint256[])', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      const b0 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
            this.protocolX,
            [this.tokenA.address, this.tokenB.address],
            [parseEther('1'), parseEther('2')],
            [parseEther('10'), parseEther('20')],
          ),
      );

      // SherX
      expect(await this.sl['getSherXPerBlock()']()).to.eq(parseEther('1'));
      expect(await this.sl.getSherXLastAccrued()).to.eq(b0);
      expect(await this.sl.totalSupply()).to.eq(0);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('50'));
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b0);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(parseEther('1'));
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(parseEther('10'));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        parseEther('1'),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(parseEther('2'));
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(parseEther('20'));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(
        parseEther('2'),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
    it('Do again', async function () {
      const b1 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
            this.protocolX,
            [this.tokenA.address, this.tokenB.address],
            [parseEther('10'), parseEther('20')],
            [parseEther('100'), parseEther('200')],
          ),
      );

      // SherX
      expect(await this.sl['getSherXPerBlock()']()).to.eq(parseEther('10'));
      expect(await this.sl.getSherXLastAccrued()).to.eq(b1);
      expect(await this.sl.totalSupply()).to.eq(parseEther('1'));

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('5000'));
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b1);
      // 1x tokenA + 2x tokenB
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(parseEther('500'));

      // token A
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(parseEther('10'));
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(parseEther('100'));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        parseEther('10'),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(parseEther('20'));
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(parseEther('200'));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(
        parseEther('20'),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
  });
  describe('setPPmAndTokenPrice(bytes32[],address,uint256[],uint256)', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      const b0 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32[],address,uint256[],uint256)'](
            [this.protocolX, this.protocolY],
            this.tokenA.address,
            [parseEther('1'), parseEther('2')],
            parseEther('10'),
          ),
      );

      // SherX
      expect(await this.sl['getSherXPerBlock()']()).to.eq(parseEther('1'));
      expect(await this.sl.getSherXLastAccrued()).to.eq(b0);
      expect(await this.sl.totalSupply()).to.eq(0);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('30'));
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b0);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(parseEther('3'));
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(parseEther('10'));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        parseEther('1'),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(
        parseEther('2'),
      );

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
    it('Do again', async function () {
      const b1 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32[],address,uint256[],uint256)'](
            [this.protocolX, this.protocolY],
            this.tokenA.address,
            [parseEther('2'), parseEther('4')],
            parseEther('20'),
          ),
      );

      // SherX
      expect(await this.sl['getSherXPerBlock()']()).to.eq(parseEther('2'));
      expect(await this.sl.getSherXLastAccrued()).to.eq(b1);
      expect(await this.sl.totalSupply()).to.eq(parseEther('1'));

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('120'));
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b1);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(parseEther('60'));

      // token A
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(parseEther('6'));
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(parseEther('20'));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        parseEther('2'),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(
        parseEther('4'),
      );

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
  });
  describe('setPPmAndTokenPrice(bytes32[],address[][],uint256[][],uint256[][])', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      const b0 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32[],address[][],uint256[][],uint256[][])'](
            [this.protocolX, this.protocolY],
            [[this.tokenA.address, this.tokenB.address], [this.tokenA.address]],
            [[parseEther('1'), parseEther('2')], [parseEther('3')]],
            [[parseEther('10'), parseEther('20')], [parseEther('10')]],
          ),
      );

      // SherX
      expect(await this.sl['getSherXPerBlock()']()).to.eq(parseEther('1'));
      expect(await this.sl.getSherXLastAccrued()).to.eq(b0);
      expect(await this.sl.totalSupply()).to.eq(0);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('80'));
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b0);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(parseEther('4'));
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(parseEther('10'));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        parseEther('1'),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(
        parseEther('3'),
      );

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(parseEther('2'));
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(parseEther('20'));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(
        parseEther('2'),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
    it('Do again', async function () {
      const b1 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32[],address[][],uint256[][],uint256[][])'](
            [this.protocolX, this.protocolY],
            [[this.tokenA.address, this.tokenB.address], [this.tokenA.address]],
            [[parseEther('2'), parseEther('4')], [parseEther('6')]],
            [[parseEther('100'), parseEther('200')], [parseEther('100')]],
          ),
      );

      // SherX
      expect(await this.sl['getSherXPerBlock()']()).to.eq(parseEther('2'));
      expect(await this.sl.getSherXLastAccrued()).to.eq(b1);
      expect(await this.sl.totalSupply()).to.eq(parseEther('1'));

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('1600'));
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b1);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(parseEther('800'));

      // token A
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(parseEther('8'));
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(parseEther('100'));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        parseEther('2'),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(
        parseEther('6'),
      );

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(parseEther('4'));
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(parseEther('200'));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(
        parseEther('4'),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
  });
});
