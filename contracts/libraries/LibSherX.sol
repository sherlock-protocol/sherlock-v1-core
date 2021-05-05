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

import '../storage/LibPool.sol';
import '../libraries/LibSherXERC20.sol';
import '../storage/LibGov.sol';

import '../interfaces/ISherX.sol';
import '../interfaces/ILock.sol';

import './LibPool.sol';

library LibSherX {
  using SafeMath for uint256;

  // TODO accrueSherX(address token), to just accrue for a certain token
  // do accrueSherX() to loop over all if updating weights

  function accrueUSDPool() external {
    SherXStorage.Base storage sx = SherXStorage.sx();
    sx.totalUsdPool = sx.totalUsdPool.add(
      block.number.sub(sx.totalUsdLastSettled).mul(sx.totalUsdPerBlock)
    );
    sx.totalUsdLastSettled = block.number;
  }

  function getUnmintedSherX(address _token) external view returns (uint256 amount) {
    SherXStorage.Base storage sx = SherXStorage.sx();
    uint256 total = block.number.sub(sx.sherXLastAccrued).mul(sx.sherXPerBlock);

    PoolStorage.Base storage ps = PoolStorage.ps(_token);
    amount = total.mul(ps.sherXWeight).div(10**18);
  }

  function accrueSherX() external {
    // loop over pools, increase the pool + pool_weight based on the distribution weights

    GovStorage.Base storage gs = GovStorage.gs();
    SherXStorage.Base storage sx = SherXStorage.sx();

    // mint sherX tokens op basis van (sx.sherXPerBlock) diff

    uint256 amount = block.number.sub(sx.sherXLastAccrued).mul(sx.sherXPerBlock);
    if (amount == 0) {
      return;
    }

    for (uint256 i; i < gs.tokens.length; i++) {
      IERC20 token = gs.tokens[i];

      PoolStorage.Base storage ps = PoolStorage.ps(address(token));

      uint256 sherX = amount.mul(ps.sherXWeight).div(10**18);
      if (address(token) == address(this)) {
        ps.stakeBalance = ps.stakeBalance.add(sherX);
      } else {
        ps.unmaterializedSherX = ps.unmaterializedSherX.add(sherX);
        ps.sWeight = ps.sWeight.add(sherX);
      }
    }
    LibSherXERC20.mint(address(this), amount);
    sx.sherXLastAccrued = block.number;
  }
}
