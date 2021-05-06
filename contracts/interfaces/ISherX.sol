// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface ISherX {
  //
  // Events
  //

  //
  // View methods
  //

  function getTotalUsdPerBlock() external view returns (uint256);

  function getTotalUsdPool() external view returns (uint256);

  function getTotalUsdLastSettled() external view returns (uint256);

  function getSherXPerBlock() external view returns (uint256);

  function getSherXLastAccrued() external view returns (uint256);

  function calcUnderlying()
    external
    view
    returns (IERC20[] memory tokens, uint256[] memory amounts);

  function calcUnderlying(uint256 _amount)
    external
    view
    returns (IERC20[] memory tokens, uint256[] memory amounts);

  function calcUnderlying(address _user)
    external
    view
    returns (IERC20[] memory tokens, uint256[] memory amounts);

  function calcUnderlyingInStoredUSD() external view returns (uint256 usd);

  function calcUnderlyingInStoredUSD(uint256 _amount) external view returns (uint256 usd);

  //
  // State changing methods
  //

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) external;

  function setInitialWeight(address _token) external;

  function setWeights(address[] memory _tokens, uint256[] memory _weights) external;

  function harvest() external;

  function harvest(address _token) external;

  function harvest(address[] calldata _tokens) external;

  function harvestFor(address _user) external;

  function harvestFor(address _user, address _token) external;

  function harvestFor(address _user, address[] calldata _tokens) external;

  function redeem(uint256 _amount, address _receiver) external;
}
