// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.0;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import 'hardhat/console.sol';

library GovStorage {
  bytes32 constant GOV_STORAGE_POSITION = keccak256('diamond.sherlock.gov');

  struct Base {
    address govInsurance;
    mapping(bytes32 => address) protocolManagers;
    mapping(bytes32 => address) protocolAgents;
    uint256 unstakeCooldown;
    uint256 unstakeWindow;
    mapping(bytes32 => bool) protocolIsCovered;
    IERC20[] tokens;
  }

  function gs() internal pure returns (Base storage bs) {
    bytes32 position = GOV_STORAGE_POSITION;
    assembly {
      bs.slot := position
    }
  }
}
