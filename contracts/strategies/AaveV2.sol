// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';

import '../interfaces/aaveV2/ILendingPool.sol';
import '../interfaces/aaveV2/ILendingPoolAddressesProvider.sol';
import '../interfaces/aaveV2/IAaveIncentivesController.sol';

import '../interfaces/IStrategy.sol';

contract AaveV2 is IStrategy {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  IERC20 public override want;
  IERC20 public aWant;
  address internal sherlock;
  ILendingPoolAddressesProvider internal lpAddressProvider;
  IAaveIncentivesController internal aaveIncentivesController;

  modifier onlySherlock() {
    require(msg.sender == sherlock, 'sherlock');
    _;
  }

  constructor(
    IERC20 _want,
    IERC20 _aWant,
    address _sherlock,
    ILendingPoolAddressesProvider _lendingPoolAddressProvider,
    IAaveIncentivesController _aaveIncentivesController
  ) {
    want = _want;
    aWant = _aWant;
    sherlock = _sherlock;
    lpAddressProvider = _lendingPoolAddressProvider;
    aaveIncentivesController = _aaveIncentivesController;
  }

  function getLp() internal view returns (ILendingPool) {
    return ILendingPool(lpAddressProvider.getLendingPool());
  }

  function withdrawAll() external override onlySherlock returns (uint256) {
    ILendingPool lp = getLp();
    if (aBalance() == 0) {
      return 0;
    }
    return lp.withdraw(address(want), uint256(-1), msg.sender);
  }

  function withdraw(uint256 _amount) external override onlySherlock {
    ILendingPool lp = getLp();
    lp.withdraw(address(want), _amount, msg.sender);
  }

  function deposit() external override {
    ILendingPool lp = getLp();
    uint256 amount = want.balanceOf(address(this));
    require(amount > 0, 'ZERO_AMOUNT');

    // TODO, do max approval once? e.g. in constructor
    want.approve(address(lp), amount);
    lp.deposit(address(want), amount, address(this), 0);
  }

  function aBalance() internal view returns (uint256) {
    return aWant.balanceOf(address(this));
  }

  function stkAaveBalance() internal view returns (uint256) {
    (uint256 index, , ) = aaveIncentivesController.getAssetData(address(aWant));
    if (index == 0) {
      return 0;
    }

    address[] memory tokens = new address[](1);
    tokens[0] = address(aWant);
    return aaveIncentivesController.getRewardsBalance(tokens, address(this));
  }

  function balanceOf() external view override returns (uint256) {
    return aBalance();
  }
}
