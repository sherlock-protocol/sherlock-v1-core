// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IManager {
  function setTokenPrice(IERC20 _token, uint256 _price) external;

  //function setTokenPrice(IERC20[] _token, uint256[] _price) external;

  function setProtocolPremium(
    bytes32 _protocol,
    IERC20 _token,
    uint256 _premium
  ) external;

  // function setProtocolPremium(
  //   bytes32 _protocol[],
  //   IERC20 _token,
  //   uint256 _premium[]
  // ) external;

  // function setProtocolPremium(
  //   bytes32 _protocol,
  //   IERC20 _token[],
  //   uint256 _premium[]
  // ) external;

  function setProtocolPremiumAndTokenPrice(
    bytes32 _protocol,
    IERC20 _token,
    uint256 _premium,
    uint256 _price
  ) external;

  // function setProtocolPremiumAndTokenPrice(
  //   bytes32 _protocol[],
  //   IERC20 _token,
  //   uint256 _premium[]
  //   uint256 _price
  // ) external;

  function setProtocolPremiumAndTokenPrice(
    bytes32 _protocol,
    IERC20[] memory _token,
    uint256[] memory _premium,
    uint256[] memory _price
  ) external;
}
