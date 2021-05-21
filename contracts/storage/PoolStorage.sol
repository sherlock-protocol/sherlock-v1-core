// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.0;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import 'hardhat/console.sol';

import '../interfaces/ILock.sol';

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

// TokenStorage
library PoolStorage {
  string constant POOL_STORAGE_PREFIX = 'diamond.sherlock.pool.';

  struct Base {
    address govPool;
    //
    // Staking
    //
    bool stakes;
    ILock lockToken;
    uint256 activateCooldownFee;
    uint256 stakeBalance;
    mapping(address => UnstakeEntry[]) unstakeEntries;
    uint256 firstMoneyOut;
    uint256 unallocatedSherX;
    // How much sherX is distributed to stakers of this token
    uint256 sherXWeight;
    uint256 sherXLastAccrued;
    // Non-native variables
    mapping(address => uint256) sWithdrawn;
    uint256 sWeight;
    //
    // Protocol payments
    //
    bool premiums;
    mapping(bytes32 => uint256) protocolBalance;
    mapping(bytes32 => uint256) protocolPremium;
    uint256 totalPremiumPerBlock;
    uint256 totalPremiumLastPaid;
    // How much token (this) is available for sherX holders
    uint256 sherXUnderlying;
    mapping(bytes32 => bool) isProtocol;
    bytes32[] protocols;
  }

  struct UnstakeEntry {
    uint256 blockInitiated;
    uint256 lock;
  }

  function ps(IERC20 _token) internal pure returns (Base storage psx) {
    bytes32 position = keccak256(abi.encode(POOL_STORAGE_PREFIX, _token));
    assembly {
      psx.slot := position
    }
  }
}
