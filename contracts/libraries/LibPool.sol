// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import 'hardhat/console.sol';

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import '../storage/LibGov.sol';
import '../storage/LibPool.sol';
import '../storage/LibSherX.sol';

library LibPool {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;
  using SafeERC20 for ILock;

  function accruedDebt(bytes32 _protocol, IERC20 _token) public view returns (uint256) {
    PoolStorage.Base storage ps = PoolStorage.ps(address(_token));

    return block.number.sub(ps.totalPremiumLastPaid).mul(ps.protocolPremium[_protocol]);
  }

  function getTotalAccruedDebt(IERC20 _token) public view returns (uint256) {
    PoolStorage.Base storage ps = PoolStorage.ps(address(_token));

    return block.number.sub(ps.totalPremiumLastPaid).mul(ps.totalPremiumPerBlock);
  }

  function getTotalUnmintedSherX(address _token) public view returns (uint256 sherX) {
    PoolStorage.Base storage ps = PoolStorage.ps(address(_token));
    SherXStorage.Base storage sx = SherXStorage.sx();
    uint256 amount = block.number.sub(sx.sherXLastAccrued).mul(sx.sherXPerBlock);
    sherX = amount.mul(ps.sherXWeight).div(10**18);
  }

  function getUnallocatedSherXFor(address _user, address _token)
    external
    view
    returns (uint256 withdrawable_amount)
  {
    PoolStorage.Base storage ps = PoolStorage.ps(address(_token));

    uint256 userAmount = ps.lockToken.balanceOf(_user);
    uint256 totalAmount = ps.lockToken.totalSupply();
    if (totalAmount == 0) {
      return 0;
    }

    uint256 raw_amount =
      ps.sWeight.add(getTotalUnmintedSherX(_token)).mul(userAmount).div(totalAmount);
    withdrawable_amount = raw_amount.sub(ps.sWithdrawn[_user]);
  }

  function stake(
    PoolStorage.Base storage ps,
    uint256 _amount,
    address _receiver
  ) external returns (uint256 lock) {
    uint256 totalLock = ps.lockToken.totalSupply();
    if (totalLock == 0) {
      // mint initial lock
      lock = 10**18;
    } else {
      // mint lock based on funds in pool
      lock = _amount.mul(totalLock).div(ps.stakeBalance);
    }
    ps.stakeBalance = ps.stakeBalance.add(_amount);
    ps.lockToken.mint(_receiver, lock);
  }

  function payOffDebtAll(IERC20 _token) external {
    PoolStorage.Base storage ps = PoolStorage.ps(address(_token));
    for (uint256 i = 0; i < ps.protocols.length; i++) {
      payOffDebt(ps.protocols[i], _token);
    }

    uint256 totalAccruedDebt = getTotalAccruedDebt(_token);
    // move funds to the sherX etf
    ps.sherXUnderlying = ps.sherXUnderlying.add(totalAccruedDebt);
    ps.totalPremiumLastPaid = block.number;
  }

  function payOffDebt(bytes32 _protocol, IERC20 _token) private {
    PoolStorage.Base storage ps = PoolStorage.ps(address(_token));
    // todo optimize by forwarding  block.number.sub(protocolPremiumLastPaid) instead of calculating every loop
    uint256 debt = accruedDebt(_protocol, _token);
    ps.protocolBalance[_protocol] = ps.protocolBalance[_protocol].sub(debt);
  }
}
