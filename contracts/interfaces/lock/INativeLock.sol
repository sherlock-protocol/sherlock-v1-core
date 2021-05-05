// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface INativeLock is IERC20 {
  function getOwner() external view returns (address);

  function mint(address _account, uint256 _amount) external;

  function burn(address _account, uint256 _amount) external;
}
