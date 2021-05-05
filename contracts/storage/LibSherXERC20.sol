// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.1;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

library SherXERC20Storage {
  bytes32 constant SHERX_ERC20_STORAGE_POSITION = keccak256('diamond.sherlock.x.erc20');

  struct Base {
    string name;
    string symbol;
    uint256 totalSupply;
    mapping(address => uint256) balances;
    mapping(address => mapping(address => uint256)) allowances;
  }

  function sx20() internal pure returns (Base storage sx20) {
    bytes32 position = SHERX_ERC20_STORAGE_POSITION;
    assembly {
      sx20.slot := position
    }
  }
}
