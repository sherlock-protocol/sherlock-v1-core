//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "hardhat/console.sol";

library PayoutStorage {
    bytes32 constant PAYOUT_STORAGE_POSITION = keccak256(
        "diamond.sherlock.payout"
    );

    struct Base {
        address govPayout;
    }

    function ps() internal pure returns (Base storage ps) {
        bytes32 position = PAYOUT_STORAGE_POSITION;
        assembly {
            ps.slot := position
        }
    }
}
