const { expect } = require('chai');
const { parseEther, parseUnits } = require('ethers/lib/utils');

const { prepare, deploy, solution, blockNumber } = require('./utilities');
const { constants } = require('ethers');
const { TimeTraveler } = require('./utilities/snapshot');

describe('Manager - Clean', function () {
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

    await this.tokenA.approve(this.sl.address, parseUnits('10000', this.tokenA.dec));
    await this.tokenB.approve(this.sl.address, parseUnits('10000', this.tokenB.dec));
    await this.sl.depositProtocolBalance(
      this.protocolX,
      parseUnits('100', this.tokenA.dec),
      this.tokenA.address,
    );
    await this.sl.depositProtocolBalance(
      this.protocolX,
      parseUnits('100', this.tokenB.dec),
      this.tokenB.address,
    );
    await this.sl.depositProtocolBalance(
      this.protocolY,
      parseUnits('100', this.tokenA.dec),
      this.tokenA.address,
    );
    await this.sl.depositProtocolBalance(
      this.protocolY,
      parseUnits('100', this.tokenB.dec),
      this.tokenB.address,
    );
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

    expect(await this.tokenA.dec).to.eq(18);
    expect(await this.tokenA.usdDec).to.eq(18);
    expect(await this.tokenB.dec).to.eq(6);
    expect(await this.tokenB.usdDec).to.eq(30);
  });
  describe('setTokenPrice(address,uint256)', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      const aPrice = parseUnits('1', this.tokenA.usdDec);
      const b0 = await blockNumber(
        this.sl.c(this.gov)['setTokenPrice(address,uint256)'](this.tokenA.address, aPrice),
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
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(aPrice);
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
      const aPrice = parseUnits('2', this.tokenA.usdDec);
      const b1 = await blockNumber(
        this.sl.c(this.gov)['setTokenPrice(address,uint256)'](this.tokenA.address, aPrice),
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
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(aPrice);
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
      const aPrice = parseUnits('1', this.tokenA.usdDec);
      const bPrice = parseUnits('2', this.tokenB.usdDec);
      const b0 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setTokenPrice(address[],uint256[])'](
            [this.tokenA.address, this.tokenB.address],
            [aPrice, bPrice],
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
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(aPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(bPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
    it('Do again', async function () {
      const aPrice = parseUnits('2', this.tokenA.usdDec);
      const bPrice = parseUnits('4', this.tokenB.usdDec);
      const b1 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setTokenPrice(address[],uint256[])'](
            [this.tokenA.address, this.tokenB.address],
            [aPrice, bPrice],
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
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(aPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(bPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
  });
  describe('setPPm(bytes32,address,uint256)', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      const aPremium = parseUnits('1', this.tokenA.dec);
      const b0 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremium(bytes32,address,uint256)'](
            this.protocolX,
            this.tokenA.address,
            aPremium,
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
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
    it('Do again', async function () {
      const aPremium = parseUnits('2', this.tokenA.dec);
      const b1 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremium(bytes32,address,uint256)'](
            this.protocolX,
            this.tokenA.address,
            aPremium,
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
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(aPremium);
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
      const aPremium = parseUnits('1', this.tokenA.dec);
      const bPremium = parseUnits('2', this.tokenB.dec);
      const b0 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremium(bytes32,address[],uint256[])'](
            this.protocolX,
            [this.tokenA.address, this.tokenB.address],
            [aPremium, bPremium],
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
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(bPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(bPremium);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
    it('Do again', async function () {
      const aPremium = parseUnits('2', this.tokenA.dec);
      const bPremium = parseUnits('4', this.tokenB.dec);
      const b1 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremium(bytes32,address[],uint256[])'](
            this.protocolX,
            [this.tokenA.address, this.tokenB.address],
            [aPremium, bPremium],
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
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(bPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(bPremium);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
  });
  describe('setPPm(bytes32[],address[][],uint256[][])', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      const aPremiumX = parseUnits('1', this.tokenA.dec);
      const bPremium = parseUnits('2', this.tokenB.dec);
      const aPremiumY = parseUnits('3', this.tokenA.dec);
      const b0 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremium(bytes32[],address[][],uint256[][])'](
            [this.protocolX, this.protocolY],
            [[this.tokenA.address, this.tokenB.address], [this.tokenA.address]],
            [[aPremiumX, bPremium], [aPremiumY]],
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
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(
        aPremiumX.add(aPremiumY),
      );
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        aPremiumX,
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(
        aPremiumY,
      );

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(bPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(bPremium);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
    it('Do again', async function () {
      const aPremiumX = parseUnits('2', this.tokenA.dec);
      const bPremium = parseUnits('4', this.tokenB.dec);
      const aPremiumY = parseUnits('6', this.tokenA.dec);
      const b1 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremium(bytes32[],address[][],uint256[][])'](
            [this.protocolX, this.protocolY],
            [[this.tokenA.address, this.tokenB.address], [this.tokenA.address]],
            [[aPremiumX, bPremium], [aPremiumY]],
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
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(
        aPremiumX.add(aPremiumY),
      );
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        aPremiumX,
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(
        aPremiumY,
      );

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(bPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(bPremium);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
  });
  describe('setPPmAndTokenPrice(bytes32,address,uint256,uint256)', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      const aPremium = parseUnits('1', this.tokenA.dec);
      const aPrice = parseUnits('2', this.tokenA.usdDec);
      const b0 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32,address,uint256,uint256)'](
            this.protocolX,
            this.tokenA.address,
            aPremium,
            aPrice,
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
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(aPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
    it('Do again', async function () {
      const aPremium = parseUnits('2', this.tokenA.dec);
      const aPrice = parseUnits('4', this.tokenA.usdDec);
      const b1 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32,address,uint256,uint256)'](
            this.protocolX,
            this.tokenA.address,
            aPremium,
            aPrice,
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
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(aPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(aPremium);
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
      const aPremium = parseUnits('1', this.tokenA.dec);
      const aPrice = parseUnits('10', this.tokenA.usdDec);
      const bPremium = parseUnits('2', this.tokenB.dec);
      const bPrice = parseUnits('20', this.tokenB.usdDec);
      const b0 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
            this.protocolX,
            [this.tokenA.address, this.tokenB.address],
            [aPremium, bPremium],
            [aPrice, bPrice],
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
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(aPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(bPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(bPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(bPremium);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
    it('Do again', async function () {
      const aPremium = parseUnits('10', this.tokenA.dec);
      const aPrice = parseUnits('100', this.tokenA.usdDec);
      const bPremium = parseUnits('20', this.tokenB.dec);
      const bPrice = parseUnits('200', this.tokenB.usdDec);
      const b1 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
            this.protocolX,
            [this.tokenA.address, this.tokenB.address],
            [aPremium, bPremium],
            [aPrice, bPrice],
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
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(aPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(bPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(bPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(bPremium);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
  });
  describe('setPPmAndTokenPrice(bytes32[],address,uint256[],uint256)', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      const aPremiumX = parseUnits('1', this.tokenA.dec);
      const aPremiumY = parseUnits('2', this.tokenA.dec);
      const aPrice = parseUnits('10', this.tokenA.usdDec);
      const b0 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32[],address,uint256[],uint256)'](
            [this.protocolX, this.protocolY],
            this.tokenA.address,
            [aPremiumX, aPremiumY],
            aPrice,
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
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(
        aPremiumX.add(aPremiumY),
      );
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(aPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        aPremiumX,
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(
        aPremiumY,
      );

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
    it('Do again', async function () {
      const aPremiumX = parseUnits('2', this.tokenA.dec);
      const aPremiumY = parseUnits('4', this.tokenA.dec);
      const aPrice = parseUnits('20', this.tokenA.usdDec);
      const b1 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32[],address,uint256[],uint256)'](
            [this.protocolX, this.protocolY],
            this.tokenA.address,
            [aPremiumX, aPremiumY],
            aPrice,
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
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(
        aPremiumX.add(aPremiumY),
      );
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(aPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        aPremiumX,
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(
        aPremiumY,
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
      const aPremiumX = parseUnits('1', this.tokenA.dec);
      const bPremiumX = parseUnits('2', this.tokenB.dec);
      const aPremiumY = parseUnits('3', this.tokenA.dec);

      const aPrice = parseUnits('10', this.tokenA.usdDec);
      const bPrice = parseUnits('20', this.tokenB.usdDec);
      const b0 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32[],address[][],uint256[][],uint256[][])'](
            [this.protocolX, this.protocolY],
            [[this.tokenA.address, this.tokenB.address], [this.tokenA.address]],
            [[aPremiumX, bPremiumX], [aPremiumY]],
            [[aPrice, bPrice], [aPrice]],
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
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(
        aPremiumX.add(aPremiumY),
      );
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(aPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        aPremiumX,
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(
        aPremiumY,
      );

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(bPremiumX);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(bPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(
        bPremiumX,
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
    it('Do again', async function () {
      const aPremiumX = parseUnits('2', this.tokenA.dec);
      const bPremiumX = parseUnits('4', this.tokenB.dec);
      const aPremiumY = parseUnits('6', this.tokenA.dec);

      const aPrice = parseUnits('100', this.tokenA.usdDec);
      const bPrice = parseUnits('200', this.tokenB.usdDec);

      const b1 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32[],address[][],uint256[][],uint256[][])'](
            [this.protocolX, this.protocolY],
            [[this.tokenA.address, this.tokenB.address], [this.tokenA.address]],
            [[aPremiumX, bPremiumX], [aPremiumY]],
            [[aPrice, bPrice], [aPrice]],
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
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(
        aPremiumX.add(aPremiumY),
      );
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(aPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        aPremiumX,
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(
        aPremiumY,
      );

      // token B
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(bPremiumX);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(bPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(
        bPremiumX,
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
  });
});
