// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

library TimelockStorage {
  bytes32 constant TIMELOCK_STORAGE_POSITION = keccak256(
    "diamond.sherlock.timelock"
  );

  struct Base {
      // address to [] of (block, amount)
      // if now >= block, amount can be freed for address
      // if now == 0 (deleted), it is an invalid/claimed entry
      mapping(address => uint256[2][]) entries;
  }

  function timelockStorage() internal pure returns (Base storage ts) {
    bytes32 position = TIMELOCK_STORAGE_POSITION;
    assembly {
      ts.slot := position
    }
  }
}