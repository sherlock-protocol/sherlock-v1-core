// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '../interfaces/ILock.sol';
import '../interfaces/IRemove.sol';

interface IGov {
  //
  // Events
  //

  //
  // View methods
  //

  function getGovInsurance() external view returns (address);

  function getWatsons() external view returns (address);

  function getWatsonsSherXWeight() external view returns (uint256);

  function getWatsonsSherxLastAccrued() external view returns (uint256);

  function getWatsonsSherXPerBlock() external view returns (uint256);

  function getWatsonsUnmintedSherX() external view returns (uint256);

  function getUnstakeWindow() external view returns (uint256);

  function getCooldown() external view returns (uint256);

  function getTokensStaker() external view returns (IERC20[] memory);

  function getTokensProtocol() external view returns (IERC20[] memory);

  function getProtocolIsCovered(bytes32 _protocol) external view returns (bool);

  function getProtocolManager(bytes32 _protocol) external view returns (address);

  function getProtocolAgent(bytes32 _protocol) external view returns (address);

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

  function tokenInit(
    IERC20 _token,
    address _govPool,
    ILock _lock,
    bool _protocolPremium
  ) external;

  function tokenDisableStakers(IERC20 _token, uint256 _index) external;

  function tokenDisableProtocol(IERC20 _token, uint256 _index) external;

  function tokenRemove(
    IERC20 _token,
    IRemove _native,
    address _sherx
  ) external;
}
