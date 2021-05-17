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

import '../interfaces/ISherX.sol';
import '../interfaces/ILock.sol';
import '../interfaces/ILock.sol';

import '../libraries/LibPool.sol';
import '../libraries/LibSherX.sol';
import '../libraries/LibSherXERC20.sol';

import '../storage/LibSherXERC20.sol';

contract SherX is ISherX {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  //
  // Modifiers
  //

  modifier onlyGovInsurance() {
    require(msg.sender == GovStorage.gs().govInsurance, 'NOT_GOV_INS');
    _;
  }

  //
  // View methods
  //

  function getTotalUsdPerBlock() external view override returns (uint256) {
    return SherXStorage.sx().totalUsdPerBlock;
  }

  function getTotalUsdPoolStored() external view override returns (uint256) {
    return SherXStorage.sx().totalUsdPool;
  }

  function getTotalUsdPool() external view override returns (uint256) {
    SherXStorage.Base storage sx = SherXStorage.sx();
    return sx.totalUsdPool.add(block.number.sub(sx.totalUsdLastSettled).mul(sx.totalUsdPerBlock));
  }

  function getTotalUsdLastSettled() external view override returns (uint256) {
    return SherXStorage.sx().totalUsdLastSettled;
  }

  function getStoredUsd(IERC20 _token) external view override returns (uint256) {
    return SherXStorage.sx().tokenUSD[_token];
  }

  function getTotalSherXUnminted() external view override returns (uint256) {
    return LibSherX.getTotalSherXUnminted();
  }

  function getTotalSherX() external view override returns (uint256) {
    return LibSherX.getTotalSherX();
  }

  function getSherXPerBlock() external view override returns (uint256) {
    return SherXStorage.sx().sherXPerBlock;
  }

  function getSherXLastAccrued() external view override returns (uint256) {
    return SherXStorage.sx().sherXLastAccrued;
  }

  function getSherXBalance() external view override returns (uint256) {
    return getSherXBalance(msg.sender);
  }

  function getSherXBalance(address _user) public view override returns (uint256) {
    SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();
    uint256 balance = sx20.balances[_user];
    GovStorage.Base storage gs = GovStorage.gs();
    for (uint256 i; i < gs.tokens.length; i++) {
      balance = balance.add(LibPool.getUnallocatedSherXFor(_user, address(gs.tokens[i])));
    }
    return balance;
  }

  function calcUnderlying()
    external
    view
    override
    returns (IERC20[] memory tokens, uint256[] memory amounts)
  {
    return calcUnderlying(msg.sender);
  }

  function calcUnderlying(address _user)
    public
    view
    override
    returns (IERC20[] memory tokens, uint256[] memory amounts)
  {
    return LibSherX.calcUnderlying(getSherXBalance(_user));
  }

  function calcUnderlying(uint256 _amount)
    external
    view
    override
    returns (IERC20[] memory tokens, uint256[] memory amounts)
  {
    return LibSherX.calcUnderlying(_amount);
  }

  function calcUnderlyingInStoredUSD() external view override returns (uint256) {
    SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();
    return calcUnderlyingInStoredUSD(sx20.balances[msg.sender]);
  }

  function calcUnderlyingInStoredUSD(uint256 _amount) public view override returns (uint256 usd) {
    SherXStorage.Base storage sx = SherXStorage.sx();
    GovStorage.Base storage gs = GovStorage.gs();
    SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();

    uint256 total = LibSherX.getTotalSherX();
    for (uint256 i; i < gs.tokens.length; i++) {
      IERC20 token = gs.tokens[i];

      // TODO callstack
      PoolStorage.Base storage ps = PoolStorage.ps(address(token));
      uint256 _temp =
        ps.sherXUnderlying.add(LibPool.getTotalAccruedDebt(token)).mul(_amount).mul(
          sx.tokenUSD[token]
        );
      if (total > 0) {
        _temp = _temp.div(10**18).div(total);
        usd = usd.add(_temp);
      }
    }
  }

  //
  // State changing methods
  //

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) external override {
    doYield(msg.sender, from, to, amount);
  }

  function setInitialWeight() external override onlyGovInsurance {
    GovStorage.Base storage gs = GovStorage.gs();
    require(gs.watsonsAddress != address(0), 'WATS_UNSET');
    require(gs.watsonsSherxWeight == 0, 'ALREADY_INIT');
    for (uint256 i; i < gs.tokens.length; i++) {
      PoolStorage.Base storage ps = PoolStorage.ps(address(gs.tokens[i]));
      require(ps.sherXWeight == 0, 'ALREADY_INIT_2');
    }

    gs.watsonsSherxWeight = 10**18;
  }

  function setWeights(
    address[] memory _tokens,
    uint256[] memory _weights,
    uint256 _watsons
  ) external override onlyGovInsurance {
    require(_tokens.length == _weights.length, 'LENGTH');
    LibSherX.accrueSherX();

    GovStorage.Base storage gs = GovStorage.gs();

    uint256 weightAdd;
    uint256 weightSub;

    for (uint256 i; i < _tokens.length; i++) {
      PoolStorage.Base storage ps = PoolStorage.ps(_tokens[i]);
      require(ps.initialized, 'INIT');
      // Disabled tokens can not have ps.sherXWeight > 0
      require(ps.stakes, 'DISABLED');

      weightAdd = weightAdd.add(_weights[i]);
      weightSub = weightSub.add(ps.sherXWeight);
      ps.sherXWeight = _weights[i];
    }
    if (_watsons != uint256(-1)) {
      weightAdd = weightAdd.add(_watsons);
      weightSub = weightSub.add(gs.watsonsSherxWeight);

      gs.watsonsSherxWeight = _watsons;
    }

    require(weightAdd == weightSub, 'SUM');
  }

  function harvest() external override {
    harvestFor(msg.sender);
  }

  function harvest(address _token) external override {
    harvestFor(msg.sender, _token);
  }

  function harvest(address[] calldata _tokens) external override {
    for (uint256 i; i < _tokens.length; i++) {
      harvestFor(msg.sender, _tokens[i]);
    }
  }

  function harvestFor(address _user) public override {
    GovStorage.Base storage gs = GovStorage.gs();
    for (uint256 i; i < gs.tokens.length; i++) {
      PoolStorage.Base storage ps = PoolStorage.ps(address(gs.tokens[i]));
      harvestFor(_user, address(ps.lockToken));
    }
  }

  function harvestFor(address _user, address _token) public override {
    // could potentially call harvest function for token that are not in the pool
    // if balance > 0, tx will revert
    uint256 stakeBalance = IERC20(_token).balanceOf(_user);
    if (stakeBalance > 0) {
      doYield(_token, _user, _user, 0);
    }
    emit Harvest(_user, _token);
  }

  function harvestFor(address _user, address[] calldata _tokens) external override {
    for (uint256 i; i < _tokens.length; i++) {
      harvestFor(_user, _tokens[i]);
    }
  }

  function redeem(uint256 _amount, address _receiver) external override {
    require(_amount > 0, 'AMOUNT');
    require(_receiver != address(0), 'RECEIVER');

    SherXStorage.Base storage sx = SherXStorage.sx();
    LibSherX.accrueUSDPool();
    // Note: LibSherX.accrueSherX() is removed as the calcUnderlying already takes it into consideration (without changing state)

    (IERC20[] memory tokens, uint256[] memory amounts) = LibSherX.calcUnderlying(_amount);

    uint256 subUsdPool = 0;
    for (uint256 i; i < tokens.length; i++) {
      PoolStorage.Base storage ps = PoolStorage.ps(address(tokens[i]));

      if (amounts[i] > ps.sherXUnderlying) {
        LibPool.payOffDebtAll(tokens[i]);
      }
      ps.sherXUnderlying = ps.sherXUnderlying.sub(amounts[i]);

      subUsdPool = subUsdPool.add(amounts[i].mul(sx.tokenUSD[tokens[i]]).div(10**18));

      tokens[i].safeTransfer(_receiver, amounts[i]);
    }
    sx.totalUsdPool = sx.totalUsdPool.sub(subUsdPool);
    LibSherXERC20.burn(msg.sender, _amount);
  }

  function accrueSherX() external override {
    LibSherX.accrueSherX();
  }

  function doYield(
    address token,
    address from,
    address to,
    uint256 amount
  ) private {
    address underlying = ILock(token).underlying();
    PoolStorage.Base storage ps = PoolStorage.ps(underlying);
    require(address(ps.lockToken) == token, 'Unexpected sender');
    // TODO optimize, accure only for this token
    LibSherX.accrueSherX();
    uint256 userAmount = ps.lockToken.balanceOf(from);
    uint256 totalAmount = ps.lockToken.totalSupply();

    uint256 ineglible_yield_amount;
    if (totalAmount > 0) {
      ineglible_yield_amount = ps.sWeight.mul(amount).div(totalAmount);
    } else {
      ineglible_yield_amount = amount;
    }

    if (from != address(0)) {
      uint256 raw_amount = ps.sWeight.mul(userAmount).div(totalAmount);
      uint256 withdrawable_amount = raw_amount.sub(ps.sWithdrawn[from]);
      if (withdrawable_amount > 0) {
        // store the data in a single calc
        ps.sWithdrawn[from] = raw_amount.sub(ineglible_yield_amount);

        ps.unmaterializedSherX = ps.unmaterializedSherX.sub(withdrawable_amount);
        PoolStorage.Base storage psSherX = PoolStorage.ps(address(this));
        if (from == address(this)) {
          // add SherX harvested by the pool itself to first money out pool.
          psSherX.firstMoneyOut = psSherX.firstMoneyOut.add(withdrawable_amount);
        } else {
          LibPool.stake(psSherX, withdrawable_amount, from);
        }
      } else {
        ps.sWithdrawn[from] = ps.sWithdrawn[from].sub(ineglible_yield_amount);
      }
    } else {
      ps.sWeight = ps.sWeight.add(ineglible_yield_amount);
    }

    if (to != address(0)) {
      ps.sWithdrawn[to] = ps.sWithdrawn[to].add(ineglible_yield_amount);
    } else {
      ps.sWeight = ps.sWeight.sub(ineglible_yield_amount);
    }
  }
}
