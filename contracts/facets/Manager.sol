// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import 'hardhat/console.sol';

import '@openzeppelin/contracts/math/SafeMath.sol';

import '../interfaces/IManager.sol';

import '../libraries/LibSherX.sol';
import '../libraries/LibPool.sol';

contract Manager is IManager {
  using SafeMath for uint256;

  // Once transaction has been mined, protocol is officialy insured.

  // TODO
  // split updating
  // prices, premiums (and make it easy to do both)

  function setProtocolPremiums(
    bytes32 _protocol,
    IERC20[] memory _token,
    uint256[] memory _premium,
    uint256[] memory _price
  ) external override {
    require(_token.length == _premium.length, 'LENGTH');
    require(_token.length == _price.length, 'LENGTH');
    for (uint256 i; i < _token.length; i++) {
      setProtocolPremium(_protocol, _token[i], _premium[i], _price[i]);
    }
    // todo gas optimize
  }

  function setProtocolPremium(
    bytes32 _protocol,
    IERC20 _token,
    uint256 _premium,
    uint256 _price
  ) public override {
    GovStorage.Base storage gs = GovStorage.gs();
    PoolStorage.Base storage ps = PoolStorage.ps(address(_token));
    SherXStorage.Base storage sx = SherXStorage.sx();
    SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();

    require(ps.initialized, 'WHITELIST');

    LibPool.payOffDebtAll(IERC20(_token));
    if (sx.sherXLastAccrued == 0) {
      sx.sherXLastAccrued = block.number;
    }

    require(gs.protocolIsCovered[_protocol], 'NOT_COVERED');
    require(gs.protocolManagers[_protocol] == msg.sender, 'NOT_MANAGER');

    LibSherX.accrueUSDPool();
    LibSherX.accrueSherX();
    uint256 curUsd = sx.tokenUSD[_token];
    // sub old premium in usd, add new premium in usdd
    // TODO optimize, writing to times to storage
    sx.totalUsdPerBlock = sx.totalUsdPerBlock.sub(
      ps.protocolPremium[_protocol].mul(curUsd).div(10**18)
    );
    sx.totalUsdPerBlock = sx.totalUsdPerBlock.add(_premium.mul(_price).div(10**18));

    //IF price changes, we need to recalc current USD pool
    // if (sx.tokenUSD[_token] != _price) {
    sx.totalUsdPool = sx.totalUsdPool.sub(ps.sherXUnderlying.mul(curUsd).div(10**18)).add(
      ps.sherXUnderlying.mul(_price).div(10**18)
    );
    // recalcs current poolbalance

    // update price
    sx.tokenUSD[_token] = _price;

    // payoffDebt (+ add exra pool balance with new price)

    ps.totalPremiumPerBlock = ps.totalPremiumPerBlock.sub(ps.protocolPremium[_protocol]).add(
      _premium
    );
    ps.protocolPremium[_protocol] = _premium;

    if (sx.sherXPerBlock == 0) {
      sx.sherXPerBlock = 10**18;
    } else if (sx.totalUsdPool > 0) {
      // TODO validate when sx.totalUsdPool
      sx.sherXPerBlock = sx20.totalSupply.mul(sx.totalUsdPerBlock).div(sx.totalUsdPool);
    }
  }
}
