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

import '../storage/PoolStorage.sol';
import '../libraries/LibSherXERC20.sol';
import '../storage/GovStorage.sol';

import '../interfaces/ISherX.sol';
import '../interfaces/ILock.sol';

import './LibPool.sol';

library LibSherX {
  using SafeMath for uint256;

  // TODO accrueSherX(address token), to just accrue for a certain token
  // do accrueSherX() to loop over all if updating weights

  function viewAccrueUSDPool() public view returns (uint256 totalUsdPool) {
    SherXStorage.Base storage sx = SherXStorage.sx();
    totalUsdPool = sx.totalUsdPool.add(
      block.number.sub(sx.totalUsdLastSettled).mul(sx.totalUsdPerBlock)
    );
  }

  function accrueUSDPool() external returns (uint256 totalUsdPool) {
    SherXStorage.Base storage sx = SherXStorage.sx();
    totalUsdPool = viewAccrueUSDPool();
    sx.totalUsdPool = totalUsdPool;
    sx.totalUsdLastSettled = block.number;
  }

  function getUnmintedSherX(address _token) external view returns (uint256 amount) {
    SherXStorage.Base storage sx = SherXStorage.sx();
    uint256 total = block.number.sub(sx.sherXLastAccrued).mul(sx.sherXPerBlock);

    PoolStorage.Base storage ps = PoolStorage.ps(_token);
    amount = total.mul(ps.sherXWeight).div(10**18);
  }

  function getTotalSherXUnminted() public view returns (uint256) {
    SherXStorage.Base storage sx = SherXStorage.sx();
    return block.number.sub(sx.sherXLastAccrued).mul(sx.sherXPerBlock);
  }

  function getTotalSherX() public view returns (uint256) {
    SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();
    return sx20.totalSupply.add(getTotalSherXUnminted());
  }

  function calcUnderlying(uint256 _amount)
    external
    view
    returns (IERC20[] memory tokens, uint256[] memory amounts)
  {
    GovStorage.Base storage gs = GovStorage.gs();
    SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();

    tokens = new IERC20[](gs.tokens.length);
    amounts = new uint256[](gs.tokens.length);

    uint256 total = getTotalSherX();

    for (uint256 i; i < gs.tokens.length; i++) {
      IERC20 token = gs.tokens[i];
      tokens[i] = token;

      if (total > 0) {
        PoolStorage.Base storage ps = PoolStorage.ps(address(token));
        amounts[i] = ps.sherXUnderlying.add(LibPool.getTotalAccruedDebt(token)).mul(_amount).div(
          total
        );
      } else {
        amounts[i] = 0;
      }
    }
  }

  function accrueSherX() external {
    // loop over pools, increase the pool + pool_weight based on the distribution weights

    GovStorage.Base storage gs = GovStorage.gs();
    SherXStorage.Base storage sx = SherXStorage.sx();

    // mint sherX tokens op basis van (sx.sherXPerBlock) diff

    uint256 amount = block.number.sub(sx.sherXLastAccrued).mul(sx.sherXPerBlock);
    sx.sherXLastAccrued = block.number;
    if (amount == 0) {
      return;
    }

    for (uint256 i; i < gs.tokens.length; i++) {
      IERC20 token = gs.tokens[i];

      PoolStorage.Base storage ps = PoolStorage.ps(address(token));

      uint256 sherX = amount.mul(ps.sherXWeight).div(10**18);
      if (sherX == 0) {
        continue;
      }

      if (address(token) == address(this)) {
        ps.stakeBalance = ps.stakeBalance.add(sherX);
      } else {
        ps.unallocatedSherX = ps.unallocatedSherX.add(sherX);
        ps.sWeight = ps.sWeight.add(sherX);
      }
    }

    uint256 watsonsAmount = amount.mul(gs.watsonsSherxWeight).div(10**18);
    if (watsonsAmount > 0) {
      LibSherXERC20.mint(gs.watsonsAddress, watsonsAmount);
    }

    LibSherXERC20.mint(address(this), amount.sub(watsonsAmount));
  }
}
