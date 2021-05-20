// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;
pragma abicoder v2;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '../storage/PoolStorage.sol';

interface IPool {
  //
  // Events
  //

  //
  // View methods
  //

  function getCooldownFee(IERC20 _token) external view returns (uint256);

  function getSherXWeight(IERC20 _token) external view returns (uint256);

  function getGovPool(IERC20 _token) external view returns (address);

  function isPremium(IERC20 _token) external view returns (bool);

  function isStake(IERC20 _token) external view returns (bool);

  function getProtocolBalance(bytes32 _protocol, IERC20 _token) external view returns (uint256);

  function getProtocolPremium(bytes32 _protocol, IERC20 _token) external view returns (uint256);

  function getLockToken(IERC20 _token) external view returns (address);

  function isProtocol(bytes32 _protocol, IERC20 _token) external view returns (bool);

  function getProtocols(IERC20 _token) external view returns (bytes32[] memory);

  function getUnstakeEntry(
    address _staker,
    uint256 _id,
    IERC20 _token
  ) external view returns (PoolStorage.UnstakeEntry memory);

  function getTotalAccruedDebt(IERC20 _token) external view returns (uint256);

  function getFirstMoneyOut(IERC20 _token) external view returns (uint256);

  function getAccruedDebt(bytes32 _protocol, IERC20 _token) external view returns (uint256);

  function getTotalPremiumPerBlock(IERC20 _token) external view returns (uint256);

  function getPremiumLastPaid(IERC20 _token) external view returns (uint256);

  function getSherXUnderlying(IERC20 _token) external view returns (uint256);

  function getUnstakeEntrySize(address _staker, IERC20 _token) external view returns (uint256);

  function getInitialUnstakeEntry(address _staker, IERC20 _token) external view returns (uint256);

  function getStakersPoolBalance(IERC20 _token) external view returns (uint256);

  function getStakerPoolBalance(address _staker, IERC20 _token) external view returns (uint256);

  function getTotalUnmintedSherX(IERC20 _token) external view returns (uint256);

  function getUnallocatedSherXStored(IERC20 _token) external view returns (uint256);

  function getUnallocatedSherXTotal(IERC20 _token) external view returns (uint256);

  function getUnallocatedSherXFor(address _user, IERC20 _token) external view returns (uint256);

  function getTotalSherXPerBlock(IERC20 _token) external view returns (uint256);

  function getSherXPerBlock(IERC20 _token) external view returns (uint256);

  function getSherXPerBlock(address _user, IERC20 _token) external view returns (uint256);

  function getSherXPerBlock(uint256 _amount, IERC20 _token) external view returns (uint256);

  function getSherXLastAccrued(IERC20 _token) external view returns (uint256);

  function LockToTokenXRate(IERC20 _token) external view returns (uint256);

  function LockToToken(uint256 _amount, IERC20 _token) external view returns (uint256);

  function TokenToLockXRate(IERC20 _token) external view returns (uint256);

  function TokenToLock(uint256 _amount, IERC20 _token) external view returns (uint256);

  //
  // State changing methods
  //

  function setCooldownFee(uint256 _fee, IERC20 _token) external;

  function depositProtocolBalance(
    bytes32 _protocol,
    uint256 _amount,
    IERC20 _token
  ) external;

  function withdrawProtocolBalance(
    bytes32 _protocol,
    uint256 _amount,
    address _receiver,
    IERC20 _token
  ) external;

  function stake(
    uint256 _amount,
    address _receiver,
    IERC20 _token
  ) external returns (uint256);

  function activateCooldown(uint256 _amount, IERC20 _token) external returns (uint256);

  function cancelCooldown(uint256 _id, IERC20 _token) external;

  function unstakeWindowExpiry(
    address _account,
    uint256 _id,
    IERC20 _token
  ) external;

  function unstake(
    uint256 _id,
    address _receiver,
    IERC20 _token
  ) external returns (uint256 amount);

  function payOffDebtAll(IERC20 _token) external;

  function cleanProtocol(
    bytes32 _protocol,
    uint256 _index,
    bool _forceDebt,
    address _receiver,
    IERC20 _token
  ) external;
}
