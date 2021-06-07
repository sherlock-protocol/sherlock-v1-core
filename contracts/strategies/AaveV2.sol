// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';

import '../interfaces/aaveV2/ILendingPool.sol';
import '../interfaces/aaveV2/ILendingPoolAddressesProvider.sol';
import '../interfaces/aaveV2/IAaveIncentivesController.sol';
import '../interfaces/aaveV2/IStakeAave.sol';
import '../interfaces/aaveV2/IAToken.sol';

import '../interfaces/chainlink/IAggregatorV3Interface.sol';

import '../interfaces/IStrategy.sol';

contract AaveV2 is IStrategy, Ownable {
  using SafeMath for uint256;

  IUniswapV2Router02 router = IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
  IStakeAave stakeAave = IStakeAave(0x4da27a545c0c5B758a6BA100e3a049001de870f5);
  IERC20 aave = IERC20(0xFFC97d72E13E01096502Cb8Eb52dEe56f74DAD7B);
  ILendingPoolAddressesProvider lpAddressProvider =
    ILendingPoolAddressesProvider(0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5);
  IAaveIncentivesController aaveIncentivesController;
  IAggregatorV3Interface chainlink;

  ERC20 public override want;
  IAToken aWant;

  uint256 divider;
  address sherlock;

  modifier onlySherlock() {
    require(msg.sender == sherlock, 'sherlock');
    _;
  }

  constructor(
    IAToken _aWant,
    address _sherlock,
    IAggregatorV3Interface _chainlink
  ) {
    aWant = _aWant;
    want = ERC20(_aWant.UNDERLYING_ASSET_ADDRESS());
    aaveIncentivesController = _aWant.getIncentivesController();

    sherlock = _sherlock;
    chainlink = _chainlink;

    divider = 10**(uint256(18).add(chainlink.decimals()).sub(want.decimals()));
  }

  /**
    View methods
  */

  function stkAaveBalance() public view returns (uint256) {
    (uint256 index, , ) = aaveIncentivesController.getAssetData(address(aWant));
    if (index == 0) {
      return 0;
    }

    address[] memory tokens = new address[](1);
    tokens[0] = address(aWant);
    return
      aaveIncentivesController.getRewardsBalance(tokens, address(this)).add(
        stakeAave.getTotalRewardsBalance(address(this))
      );
  }

  function stkAaveBalanceInWant() public view returns (uint256) {
    return stkAaveBalance().mul(uint256(chainlink.latestAnswer())).div(divider);
  }

  function aBalance() internal view returns (uint256) {
    return aWant.balanceOf(address(this));
  }

  function balanceOf() external view override returns (uint256) {
    return aBalance().add(stkAaveBalanceInWant());
  }

  function getLp() internal view returns (ILendingPool) {
    return ILendingPool(lpAddressProvider.getLendingPool());
  }

  /**
    Sherlock strategy methods
  */

  function deposit() public override {
    ILendingPool lp = getLp();
    uint256 amount = want.balanceOf(address(this));
    require(amount > 0, 'ZERO_AMOUNT');

    // TODO, do max approval once? e.g. in constructor
    want.approve(address(lp), amount);
    lp.deposit(address(want), amount, address(this), 0);
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

  /**
    Stake AAVE methods
  */

  function stkAaveCooldown() external onlyOwner {
    stakeAave.cooldown();
  }

  function swapToTokenViaETH(uint256 _toMinAmount) external onlyOwner {
    stakeAave.redeem(address(this), uint256(-1));

    uint256 aaveAmount = aave.balanceOf(address(this));
    want.approve(address(router), aaveAmount);
    // swap aave to eth to {token} and send to strategymanager
    address[] memory path = new address[](3);
    path[0] = address(stakeAave);
    path[1] = router.WETH();
    path[2] = address(want);
    router.swapExactTokensForTokens(aaveAmount, _toMinAmount, path, address(this), block.timestamp);

    deposit();
  }
}
