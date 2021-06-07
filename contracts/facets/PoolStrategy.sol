// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;
pragma abicoder v2;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '../interfaces/IPoolStrategy.sol';

import '../storage/GovStorage.sol';

import '../libraries/LibPool.sol';

import './Pool.sol';

contract PoolStrategy is Pool, IPoolStrategy {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  //
  // View methods
  //

  function getStrategy(IERC20 _token) external view override returns (IStrategy) {
    return baseData().strategy;
  }

  function _enforceStrategy(PoolStorage.Base storage ps) internal {
    require(address(ps.strategy) != address(0), 'STRATEGY');
  }

  //
  // State changing methods
  //

  function strategyUpdate(IStrategy _strategy, IERC20 _token) external override {
    PoolStorage.Base storage ps = baseData();
    require(_strategy.want() == _token, 'WANT');

    ps.strategy = _strategy;
  }

  function strategyDeposit(uint256 _amount, IERC20 _token) external override {
    require(_amount > 0, 'AMOUNT');
    PoolStorage.Base storage ps = baseData();
    _enforceStrategy(ps);

    ps.stakeBalance = ps.stakeBalance.sub(_amount);
    _token.safeTransfer(address(ps.strategy), _amount);

    ps.strategy.deposit();
  }

  function strategyWithdraw(uint256 _amount, IERC20 _token) external override {
    require(_amount > 0, 'AMOUNT');
    PoolStorage.Base storage ps = baseData();
    _enforceStrategy(ps);

    ps.strategy.withdraw(_amount);
    ps.stakeBalance = ps.stakeBalance.add(_amount);
  }

  function strategyWithdrawAll(IERC20 _token) external override {
    PoolStorage.Base storage ps = baseData();
    _enforceStrategy(ps);

    uint256 amount = ps.strategy.withdrawAll();
    ps.stakeBalance = ps.stakeBalance.add(amount);
  }
}
