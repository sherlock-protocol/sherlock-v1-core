// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '../interfaces/ILock.sol';

interface IGov {
  //
  // Events
  //

  event TokenAdded(IERC20 _token, ILock _lock);

  //
  // View methods
  //

  function getGovInsurance() external view returns (address);

  function getWatsons() external view returns (address);

  function getWatsonsSherXWeight() external view returns (uint256);

  function getWatsonsSherXPerBlock() external view returns (uint256 amount);

  function getWatsonsUnmintedSherX() external view returns (uint256 sherX);

  function getUnstakeWindow() external view returns (uint256 unstakeWindow);

  function getCooldown() external view returns (uint256 period);

  function getTokens() external view returns (IERC20[] memory tokens);

  function getProtocolIsCovered(bytes32 _protocol) external view returns (bool);

  function getProtocolManager(bytes32 _protocol) external view returns (address manager);

  function getProtocolAgent(bytes32 _protocol) external view returns (address agent);

  //
  // State changing methods
  //

  function setInitialGovInsurance(address _govInsurance) external;

  function transferGovInsurance(address _govInsurance) external;

  function setWatsonsAddress(address _watsons) external;

  function setUnstakeWindow(uint256 _unstakeWindow) external;

  function setCooldown(uint256 _period) external;

  function protocolAdd(
    bytes32 _protocol,
    address _eoaProtocolAgent,
    address _eoaManager,
    IERC20[] memory _tokens
  ) external;

  function protocolUpdate(
    bytes32 _protocol,
    address _eoaProtocolAgent,
    address _eoaManager
  ) external;

  function protocolDepositAdd(bytes32 _protocol, IERC20[] memory _tokens) external;

  function protocolRemove(bytes32 _protocol) external;

  // TODO transfer govpool role
  function tokenAdd(
    IERC20 _token,
    ILock _lock,
    address _govPool,
    bool _stakes
  ) external;

  function tokenDisable(IERC20 _token) external;

  function tokenRemove(
    IERC20 _token,
    uint256 _index,
    address _to
  ) external;
}
