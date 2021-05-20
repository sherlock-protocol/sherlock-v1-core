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
      .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);

    // Add tokenb as valid token
    await this.sl
      .c(this.gov)
      .tokenInit(this.tokenB.address, this.gov.address, this.lockB.address, true);

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

    // otherwise sherxperblock stays 0. as there is nothing minted
    await this.sl.c(this.gov).setWatsonsAddress(this.alice.address);
    await this.sl.c(this.gov).setInitialWeight();
    await timeTraveler.snapshot();
  });
  it('Initial state', async function () {
    // SherX
    expect(await this.sl['getSherXPerBlock()']()).to.eq(0);
    expect(await this.sl.totalSupply()).to.eq(0);
    expect(await this.sl.getInternalTotalSupply()).to.eq(0);
    expect(await this.sl.getInternalTotalSupplySettled()).to.eq(0);

    // USD
    expect(await this.sl.getTotalUsdPerBlock()).to.eq(0);
    expect(await this.sl.getTotalUsdLastSettled()).to.eq(0);
    expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

    // token A
    expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(0);
    expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(0);
    expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(0);
    expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(0);
    expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(0);
    expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

    // token B
    expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(0);
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
      expect(await this.sl.totalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b0);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(0);
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b0);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(aPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b0);
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
      expect(await this.sl.totalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b1);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(0);
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b1);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(aPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b1);
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
      expect(await this.sl.totalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b0);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(0);
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b0);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(aPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b0);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(b0);
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
      expect(await this.sl.totalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b1);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(0);
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b1);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(aPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b1);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(0);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(b1);
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
      expect(await this.sl.totalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b0);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(0);
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b0);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b0);
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
      expect(await this.sl.totalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b1);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(0);
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b1);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b1);
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
      expect(await this.sl.totalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b0);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(0);
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b0);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b0);
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
      expect(await this.sl.totalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b1);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(0);
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b1);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(0);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b1);
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
      expect(await this.sl.totalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b0);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(0);
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b0);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b0);
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
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b0);
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
      expect(await this.sl.totalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b1);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(0);
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b1);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b1);
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
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b1);
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
      expect(await this.sl.totalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b0);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('2'));
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b0);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(aPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b0);
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
      expect(await this.sl.totalSupply()).to.eq(parseEther('1'));
      expect(await this.sl.getInternalTotalSupply()).to.eq(parseEther('1'));
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b1);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('8'));
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b1);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(parseEther('4'));

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(aPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b1);
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
      expect(await this.sl.totalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b0);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('50'));
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b0);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b0);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(aPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b0);
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
      expect(await this.sl.totalSupply()).to.eq(parseEther('1'));
      expect(await this.sl.getInternalTotalSupply()).to.eq(parseEther('1'));
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b1);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('5000'));
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b1);
      // 1x tokenA + 2x tokenB
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(parseEther('500'));

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b1);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(aPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(aPremium);
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b1);
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
      expect(await this.sl.totalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b0);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('30'));
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b0);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b0);
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
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b0);
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
      expect(await this.sl.totalSupply()).to.eq(parseEther('1'));
      expect(await this.sl.getInternalTotalSupply()).to.eq(parseEther('1'));
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b1);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('120'));
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b1);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(parseEther('60'));

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b1);
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
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b1);
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
      expect(await this.sl.totalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupply()).to.eq(0);
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b0);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('80'));
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b0);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(0);

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b0);
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
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b0);
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
      expect(await this.sl.totalSupply()).to.eq(parseEther('1'));
      expect(await this.sl.getInternalTotalSupply()).to.eq(parseEther('1'));
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b1);

      // USD
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('1600'));
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b1);
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(parseEther('800'));

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b1);
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
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b1);
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

describe('Manager - Active', function () {
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
      .tokenInit(this.tokenA.address, this.gov.address, this.lockA.address, true);

    // Add tokenb as valid token
    await this.sl
      .c(this.gov)
      .tokenInit(this.tokenB.address, this.gov.address, this.lockB.address, true);

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

    // otherwise sherxperblock stays 0. as there is nothing minted
    await this.sl.c(this.gov).setWatsonsAddress(this.alice.address);
    await this.sl.c(this.gov).setInitialWeight();

    this.aPremium = parseUnits('1', this.tokenA.dec);
    this.aPrice = parseUnits('10', this.tokenA.usdDec);
    this.bPremium = parseUnits('2', this.tokenB.dec);
    this.bPrice = parseUnits('20', this.tokenB.usdDec);
    this.b0 = await blockNumber(
      this.sl
        .c(this.gov)
        ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
          this.protocolX,
          [this.tokenA.address, this.tokenB.address],
          [this.aPremium.div(2), this.bPremium.div(2)],
          [this.aPrice.div(2), this.bPrice.div(2)],
        ),
    );
    await timeTraveler.mine(4);
    this.b1 = await blockNumber(
      this.sl
        .c(this.gov)
        ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
          this.protocolX,
          [this.tokenA.address, this.tokenB.address],
          [this.aPremium, this.bPremium],
          [this.aPrice, this.bPrice],
        ),
    );
    await timeTraveler.mine(4);
    await timeTraveler.snapshot();
  });
  it('Initial state', async function () {
    // SherX
    expect(await this.sl['getSherXPerBlock()']()).to.eq(parseEther('2'));
    expect(await this.sl.totalSupply()).to.eq(parseEther('5'));
    expect(await this.sl.getTotalSherX()).to.eq(parseEther('15'));
    expect(await this.sl.getInternalTotalSupply()).to.eq(parseEther('5'));
    expect(await this.sl.getInternalTotalSupplySettled()).to.eq(this.b1);

    // USD
    expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('50'));
    expect(await this.sl.getTotalUsdLastSettled()).to.eq(this.b1);
    expect(await this.sl.getTotalUsdPoolStored()).to.eq(parseEther('125'));

    // token A
    expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(this.aPremium);
    expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(this.b1);
    expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(this.aPrice);
    expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
      this.aPremium,
    );
    expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

    // token B
    expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(this.bPremium);
    expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(this.b1);
    expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(this.bPrice);
    expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(
      this.bPremium,
    );
    expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);

    // INFO: getWatsonsSherxLastAccrued also updates.
  });
  describe('setTokenPrice(address,uint256)', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      const b2 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setTokenPrice(address,uint256)'](this.tokenA.address, this.aPrice.mul(2)),
      );

      // SherX;
      // stays the same as the composition of tokenA in block rewards is same as sherx underlying (33%)
      expect(await this.sl['getSherXPerBlock()']()).to.eq(parseEther('2'));
      expect(await this.sl.totalSupply()).to.eq(parseEther('17'));
      expect(await this.sl.getTotalSherX()).to.eq(parseEther('17'));
      expect(await this.sl.getInternalTotalSupply()).to.eq(parseEther('17'));
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b2);

      // USD
      // 1*10 + 2*20 (50) --> 1*20 + 2*20 (60)
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('60'));
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b2);
      // TokenA = (0,5×5+1×6)×20 = (2.5+6) * 20 = 170
      // TokenB = (1×5+2×6)  ×20 = (5 +12) * 20 = 340
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(parseEther('510'));

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b2);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(this.aPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b2);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(this.aPrice.mul(2));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        this.aPremium,
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b2);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(this.bPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(this.b1);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(this.bPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(
        this.bPremium,
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
  });
  describe('setTokenPrice(address[],uint256[])', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      const b2 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setTokenPrice(address[],uint256[])'](
            [this.tokenA.address, this.tokenB.address],
            [this.aPrice.mul(2), this.bPrice.mul(2)],
          ),
      );

      // SherX;
      // stays the same as the composition of tokenA/tokenB in block rewards is same as sherx underlying (33%)
      expect(await this.sl['getSherXPerBlock()']()).to.eq(parseEther('2'));
      expect(await this.sl.totalSupply()).to.eq(parseEther('17'));
      expect(await this.sl.getTotalSherX()).to.eq(parseEther('17'));
      expect(await this.sl.getInternalTotalSupply()).to.eq(parseEther('17'));
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b2);

      // USD
      // 1*10 + 2*20 (50) --> 1*20 + 2*40 (100)
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('100'));
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b2);
      // TokenA = (0,5×5+1×6)×20 = (2.5+6) * 20 = 170
      // TokenB = (1×5+2×6)  ×40 = (5 +12) * 40 = 680
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(parseEther('850'));

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b2);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(this.aPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b2);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(this.aPrice.mul(2));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        this.aPremium,
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b2);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(this.bPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(b2);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(this.bPrice.mul(2));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(
        this.bPremium,
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
  });
  describe('setPPm(bytes32,address,uint256)', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      const b2 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremium(bytes32,address,uint256)'](
            this.protocolX,
            this.tokenA.address,
            this.aPremium.mul(2),
          ),
      );

      // SherX;
      // increase of 50 -> 60 usd per block = 120%, 1,2 * 2 = 2.4
      expect(await this.sl['getSherXPerBlock()']()).to.eq(parseEther('2.4'));
      expect(await this.sl.totalSupply()).to.eq(parseEther('17'));
      expect(await this.sl.getTotalSherX()).to.eq(parseEther('17'));
      expect(await this.sl.getInternalTotalSupply()).to.eq(parseEther('17'));
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b2);

      // USD
      // 1*10 + 2*20 (50) --> 2*10 + 2*20 (60)
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('60'));
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b2);
      // TokenA = (0,5×5+1×6)×10 = (2.5+6) * 10 = 85
      // TokenB = (1×5+2×6)  ×20 = (5 +12) * 20 = 340
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(parseEther('425'));

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b2);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(
        this.aPremium.mul(2),
      );
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b2);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(this.aPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        this.aPremium.mul(2),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b2);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(this.bPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(this.b1);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(this.bPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(
        this.bPremium,
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
  });
  describe('setPPm(bytes32,address[],uint256[])', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      const b2 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremium(bytes32,address[],uint256[])'](
            this.protocolX,
            [this.tokenA.address, this.tokenB.address],
            [this.aPremium.mul(2), this.bPremium.mul(2)],
          ),
      );

      // SherX;
      // increase of 50 -> 100 usd per block = 200%, 2,0 * 2 = 4.0
      expect(await this.sl['getSherXPerBlock()']()).to.eq(parseEther('4.0'));
      expect(await this.sl.totalSupply()).to.eq(parseEther('17'));
      expect(await this.sl.getTotalSherX()).to.eq(parseEther('17'));
      expect(await this.sl.getInternalTotalSupply()).to.eq(parseEther('17'));
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b2);

      // USD
      // 1*10 + 2*20 (50) --> 2*10 + 4*20 (100)
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('100'));
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b2);
      // TokenA = (0,5×5+1×6)×10 = (2.5+6) * 10 = 85
      // TokenB = (1×5+2×6)  ×20 = (5 +12) * 20 = 340
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(parseEther('425'));

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b2);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(
        this.aPremium.mul(2),
      );
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b2);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(this.aPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        this.aPremium.mul(2),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b2);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(
        this.bPremium.mul(2),
      );
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(b2);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(this.bPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(
        this.bPremium.mul(2),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
  });
  describe('setPPm(bytes32[],address[][],uint256[][])', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      const b2 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremium(bytes32[],address[][],uint256[][])'](
            [this.protocolX, this.protocolY],
            [[this.tokenA.address, this.tokenB.address], [this.tokenA.address]],
            [[this.aPremium.mul(2), this.bPremium.mul(2)], [this.aPremium.mul(2)]],
          ),
      );
      // SherX;
      // increase of 50 -> 120 usd per block = 240%, 2,4 * 2 = 4.8
      expect(await this.sl['getSherXPerBlock()']()).to.eq(parseEther('4.8'));
      expect(await this.sl.totalSupply()).to.eq(parseEther('17'));
      expect(await this.sl.getTotalSherX()).to.eq(parseEther('17'));
      expect(await this.sl.getInternalTotalSupply()).to.eq(parseEther('17'));
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b2);

      // USD
      // 1*10 + 2*20 (50) --> 2*10 + 4*20 + 2*10 (120)
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('120'));
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b2);
      // TokenA = (0,5×5+1×6)×10 = (2.5+6) * 10 = 85
      // TokenB = (1×5+2×6)  ×20 = (5 +12) * 20 = 340
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(parseEther('425'));

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b2);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(
        this.aPremium.mul(4),
      );
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b2);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(this.aPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        this.aPremium.mul(2),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(
        this.aPremium.mul(2),
      );

      // token B
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b2);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(
        this.bPremium.mul(2),
      );
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(b2);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(this.bPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(
        this.bPremium.mul(2),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
  });
  describe('setPPmAndTokenPrice(bytes32,address,uint256,uint256)', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      const b2 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32,address,uint256,uint256)'](
            this.protocolX,
            this.tokenA.address,
            this.aPremium.mul(2),
            this.aPrice.mul(2),
          ),
      );
      // SherX;
      // increase of 50 -> 80 usd per block = 160%, 1,6 * 2 = 3.2
      // usdpool increased from 425 -> 510 = 120% increase
      // 3.2 / 1.2 = 2.66666
      expect(await this.sl['getSherXPerBlock()']()).to.eq(parseEther('2.666666666666666666'));
      expect(await this.sl.totalSupply()).to.eq(parseEther('17'));
      expect(await this.sl.getTotalSherX()).to.eq(parseEther('17'));
      expect(await this.sl.getInternalTotalSupply()).to.eq(parseEther('17'));
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b2);

      // USD
      // 1*10 + 2*20 (50) --> 2*20 + 2*20 (80)
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('80'));
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b2);
      // TokenA = (0,5×5+1×6)×20 = (2.5+6) * 20 = 170
      // TokenB = (1×5+2×6)  ×20 = (5 +12) * 20 = 340
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(parseEther('510'));

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b2);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(
        this.aPremium.mul(2),
      );
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b2);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(this.aPrice.mul(2));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        this.aPremium.mul(2),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b2);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(this.bPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(this.b1);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(this.bPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(
        this.bPremium,
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
  });
  describe('setPPmAndTokenPrice(bytes32,address[],uint256[],uint256[])', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      const b2 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32,address[],uint256[],uint256[])'](
            this.protocolX,
            [this.tokenA.address, this.tokenB.address],
            [this.aPremium.mul(2), this.bPremium.mul(2)],
            [this.aPrice.mul(2), this.bPrice.mul(2)],
          ),
      );
      // SherX;
      // increase of 50 -> 200 usd per block = 400%, 4,0 * 2 = 8
      // usdpool increased from 425 -> 850 = 200% increase
      // 8 / 2 = 4
      expect(await this.sl['getSherXPerBlock()']()).to.eq(parseEther('4'));
      expect(await this.sl.totalSupply()).to.eq(parseEther('17'));
      expect(await this.sl.getTotalSherX()).to.eq(parseEther('17'));
      expect(await this.sl.getInternalTotalSupply()).to.eq(parseEther('17'));
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b2);

      // USD
      // 1*10 + 2*20 (50) --> 2*20 + 4*40 (200)
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('200'));
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b2);
      // TokenA = (0,5×5+1×6)×20 = (2.5+6) * 20 = 170
      // TokenB = (1×5+2×6)  ×40 = (5 +12) * 40 = 680
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(parseEther('850'));

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b2);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(
        this.aPremium.mul(2),
      );
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b2);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(this.aPrice.mul(2));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        this.aPremium.mul(2),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(0);

      // token B
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b2);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(
        this.bPremium.mul(2),
      );
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(b2);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(this.bPrice.mul(2));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(
        this.bPremium.mul(2),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
  });
  describe('setPPmAndTokenPrice(bytes32[],address,uint256[],uint256)', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      const b2 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32[],address,uint256[],uint256)'](
            [this.protocolX, this.protocolY],
            this.tokenA.address,
            [this.aPremium.mul(2), this.aPremium.mul(2)],
            this.aPrice.mul(2),
          ),
      );
      // SherX;
      // increase of 50 -> 120 usd per block = 240%, 2,4 * 2 = 4,8
      // usdpool increased from 425 -> 510 = 120% increase
      // 4,8 / 1,2 = 4
      expect(await this.sl['getSherXPerBlock()']()).to.eq(parseEther('4'));
      expect(await this.sl.totalSupply()).to.eq(parseEther('17'));
      expect(await this.sl.getTotalSherX()).to.eq(parseEther('17'));
      expect(await this.sl.getInternalTotalSupply()).to.eq(parseEther('17'));
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b2);
      // USD
      // 1*10 + 2*20 (50) --> 2*20 + 2*20 + 2*20 (120)
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('120'));
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b2);
      // TokenA = (0,5×5+1×6)×20 = (2.5+6) * 20 = 170
      // TokenB = (1×5+2×6)  ×20 = (5 +12) * 20 = 340
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(parseEther('510'));

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b2);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(
        this.aPremium.mul(4),
      );
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b2);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(this.aPrice.mul(2));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        this.aPremium.mul(2),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(
        this.aPremium.mul(2),
      );

      // token B
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b2);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(this.bPremium);
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(this.b1);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(this.bPrice);
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(
        this.bPremium,
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
  });
  describe('setPPmAndTokenPrice(bytes32[],address[][],uint256[][],uint256[][])', function () {
    before(async function () {
      await timeTraveler.revertSnapshot();
    });
    it('Do', async function () {
      const b2 = await blockNumber(
        this.sl
          .c(this.gov)
          ['setProtocolPremiumAndTokenPrice(bytes32[],address[][],uint256[][],uint256[][])'](
            [this.protocolX, this.protocolY],
            [[this.tokenA.address, this.tokenB.address], [this.tokenA.address]],
            [[this.aPremium.mul(2), this.bPremium.mul(2)], [this.aPremium.mul(2)]],
            [[this.aPrice.mul(2), this.bPrice.mul(2)], [this.aPrice.mul(2)]],
          ),
      );
      // SherX;
      // increase of 50 -> 240 usd per block = 480%, 4,8 * 2 = 9,6
      // usdpool increased from 425 -> 850 = 200% increase
      // 9,6 / 2 = 4,8
      expect(await this.sl['getSherXPerBlock()']()).to.eq(parseEther('4.8'));
      expect(await this.sl.totalSupply()).to.eq(parseEther('17'));
      expect(await this.sl.getTotalSherX()).to.eq(parseEther('17'));
      expect(await this.sl.getInternalTotalSupply()).to.eq(parseEther('17'));
      expect(await this.sl.getInternalTotalSupplySettled()).to.eq(b2);

      // USD
      // 1*10 + 2*20 (50) --> 2*20 + 4*40 + 2*20 (240)
      expect(await this.sl.getTotalUsdPerBlock()).to.eq(parseEther('240'));
      expect(await this.sl.getTotalUsdLastSettled()).to.eq(b2);
      // TokenA = (0,5×5+1×6)×20 = (2.5+6) * 20 = 170
      // TokenB = (1×5+2×6)  ×40 = (5 +12) * 40 = 680
      expect(await this.sl.getTotalUsdPoolStored()).to.eq(parseEther('850'));

      // token A
      expect(await this.sl.getSherXLastAccrued(this.tokenA.address)).to.eq(b2);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenA.address)).to.eq(
        this.aPremium.mul(4),
      );
      expect(await this.sl.getPremiumLastPaid(this.tokenA.address)).to.eq(b2);
      expect(await this.sl.getStoredUsd(this.tokenA.address)).to.eq(this.aPrice.mul(2));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenA.address)).to.eq(
        this.aPremium.mul(2),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenA.address)).to.eq(
        this.aPremium.mul(2),
      );

      // token B
      expect(await this.sl.getSherXLastAccrued(this.tokenB.address)).to.eq(b2);
      expect(await this.sl.getTotalPremiumPerBlock(this.tokenB.address)).to.eq(
        this.bPremium.mul(2),
      );
      expect(await this.sl.getPremiumLastPaid(this.tokenB.address)).to.eq(b2);
      expect(await this.sl.getStoredUsd(this.tokenB.address)).to.eq(this.bPrice.mul(2));
      expect(await this.sl.getProtocolPremium(this.protocolX, this.tokenB.address)).to.eq(
        this.bPremium.mul(2),
      );
      expect(await this.sl.getProtocolPremium(this.protocolY, this.tokenB.address)).to.eq(0);
    });
  });
});
