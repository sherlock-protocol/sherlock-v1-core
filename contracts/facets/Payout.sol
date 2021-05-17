// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import 'hardhat/console.sol';

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import 'diamond-2/contracts/libraries/LibDiamond.sol';

import '../interfaces/IPayout.sol';

import '../libraries/LibSherX.sol';
import '../libraries/LibSherXERC20.sol';

import '../storage/LibPayout.sol';
import '../storage/LibGov.sol';

contract Payout is IPayout {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  //
  // Modifiers
  //

  modifier onlyGovInsurance() {
    require(msg.sender == GovStorage.gs().govInsurance, 'NOT_GOV_INS');
    _;
  }

  modifier onlyGovPayout() {
    require(msg.sender == PayoutStorage.ps().govPayout, 'NOT_GOV_PAY');
    _;
  }

  //
  // View methods
  //

  function getGovPayout() external view override returns (address) {
    return PayoutStorage.ps().govPayout;
  }

  //
  // State changing methods
  //

  function setInitialGovPayout(address _govPayout) external override {
    PayoutStorage.Base storage ps = PayoutStorage.ps();

    require(msg.sender == LibDiamond.contractOwner(), 'NOT_DEV');
    require(_govPayout != address(0), 'ZERO_GOV');
    require(ps.govPayout == address(0), 'ALREADY_SET');

    ps.govPayout = _govPayout;
  }

  function transferGovPayout(address _govPayout) external override onlyGovInsurance {
    require(_govPayout != address(0), 'ZERO_GOV');
    require(PayoutStorage.ps().govPayout != _govPayout, 'SAME_GOV');
    PayoutStorage.ps().govPayout = _govPayout;
  }

  function payout(
    address _payout,
    IERC20[] memory _tokens,
    uint256[] memory _firstMoneyOut,
    uint256[] memory _amounts,
    uint256[] memory _unmaterializedSherX,
    address _exclude
  ) external override onlyGovPayout {
    // all pools (including SherX pool) can be deducted fmo and balance
    // deducting balance will reduce the users underlying value of stake token
    // for every pool, _unmaterializedSherX can be deducted, this will decrease outstanding SherX rewards
    // for users that did not claim them (e.g materialized them and included in SherX pool)

    require(address(_payout) != address(0), 'ZERO_PAY');
    require(address(_payout) != address(this), 'THIS_PAY');
    require(_tokens.length == _firstMoneyOut.length, 'LENGTH_1');
    require(_tokens.length == _amounts.length, 'LENGTH_2');
    require(_tokens.length == _unmaterializedSherX.length, 'LENGTH_3');

    LibSherX.accrueSherX();
    uint256 totalUnmaterializedSherX = 0;
    uint256 totalSherX = 0;

    for (uint256 i; i < _tokens.length; i++) {
      address token = address(_tokens[i]);
      PoolStorage.Base storage ps = PoolStorage.ps(token);
      require(ps.initialized, 'INIT');
      require(ps.unmaterializedSherX >= _unmaterializedSherX[i], 'ERR_UNMAT_FEE');
      ps.sWeight = ps.sWeight.sub(_unmaterializedSherX[i]);
      ps.firstMoneyOut = ps.firstMoneyOut.sub(_firstMoneyOut[i]);
      ps.stakeBalance = ps.stakeBalance.sub(_amounts[i]);

      totalUnmaterializedSherX = totalUnmaterializedSherX.add(_unmaterializedSherX[i]);

      uint256 total = _firstMoneyOut[i].add(_amounts[i]);
      if (total == 0) {
        continue;
      }
      if (token == address(this)) {
        totalSherX = totalSherX.add(total);
      } else {
        // TODO, transfer later
        _tokens[i].safeTransfer(_payout, total);
      }
    }
    if (totalUnmaterializedSherX > 0) {
      totalSherX = totalSherX.add(totalUnmaterializedSherX);
    }

    SherXStorage.Base storage sx = SherXStorage.sx();

    (IERC20[] memory tokens, uint256[] memory amounts) = LibSherX.calcUnderlying(totalSherX);
    uint256 subUsdPool;
    uint256 sherUsd;

    for (uint256 i; i < tokens.length; i++) {
      PoolStorage.Base storage ps = PoolStorage.ps(address(tokens[i]));

      if (amounts[i] > ps.sherXUnderlying) {
        LibPool.payOffDebtAll(tokens[i]);
      }

      if (address(tokens[i]) == _exclude) {
        sherUsd = amounts[i].mul(sx.tokenUSD[tokens[i]]);
      } else {
        ps.sherXUnderlying = ps.sherXUnderlying.sub(amounts[i]);

        subUsdPool = subUsdPool.add(amounts[i].mul(sx.tokenUSD[tokens[i]]).div(10**18));
        // TODO, optimize transfer
        tokens[i].safeTransfer(_payout, amounts[i]);
      }
    }

    SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();

    if (sx20.totalSupply > 0) {
      uint256 curTotalUsdPool = LibSherX.viewAccrueUSDPool();

      uint256 storedUsdPriceSherX = curTotalUsdPool.div(sx20.totalSupply);
      uint256 deduction = sherUsd.div(storedUsdPriceSherX).div(10**18);

      sx.totalUsdPool = curTotalUsdPool.sub(subUsdPool);

      LibSherXERC20.burn(address(this), totalSherX.sub(deduction));
    }
  }
}
