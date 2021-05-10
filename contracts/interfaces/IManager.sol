// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;
pragma abicoder v2;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IManager {
  // updating token price for 1 token
  function setTokenPrice(IERC20 _token, uint256 _newUsd) external;

  // updating token price for 1+ tokens
  function setTokenPrice(IERC20[] memory _token, uint256[] memory _newUsd) external;

  // updating protocol's premiums for 1 token
  function setProtocolPremium(
    bytes32 _protocol,
    IERC20 _token,
    uint256 _premium
  ) external;

  // updating protocol's premiums for 1+ tokens
  function setProtocolPremium(
    bytes32 _protocol,
    IERC20[] memory _token,
    uint256[] memory _premium
  ) external;

  // NOTE: note implemented for now, same call with price has better use case
  // updating multiple protocol's premiums for 1 tokens
  // function setProtocolPremium(
  //   bytes32[] memory _protocol,
  //   IERC20 memory _token,
  //   uint256[] memory _premium
  // ) external;

  // updating multiple protocol's premiums for 1+ tokens
  function setProtocolPremium(
    bytes32[] memory _protocol,
    IERC20[][] memory _token,
    uint256[][] memory _premium
  ) external;

  // updating protocol's premiums for 1 token (+price)
  function setProtocolPremiumAndTokenPrice(
    bytes32 _protocol,
    IERC20 _token,
    uint256 _premium,
    uint256 _newUsd
  ) external;

  // updating protocol's premiums for 1+ tokens (+price)
  function setProtocolPremiumAndTokenPrice(
    bytes32 _protocol,
    IERC20[] memory _token,
    uint256[] memory _premium,
    uint256[] memory _newUsd
  ) external;

  // updating multiple protocol's premiums for 1 token (+price)
  function setProtocolPremiumAndTokenPrice(
    bytes32[] memory _protocol,
    IERC20 _token,
    uint256[] memory _premium,
    uint256 _newUsd
  ) external;

  // updating multiple protocol's premiums for 1+ tokens (+price)
  function setProtocolPremiumAndTokenPrice(
    bytes32[] memory _protocol,
    IERC20[][] memory _token,
    uint256[][] memory _premium,
    uint256[][] memory _newUsd
  ) external;
}
