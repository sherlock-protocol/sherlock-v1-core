//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "hardhat/console.sol";

library GovStorage {
    bytes32 constant GOV_STORAGE_POSITION = keccak256(abi.encode("diamond.sherlock.gov"));

    struct Base {
        mapping(bytes32 => address) protocolManagers;
        mapping(bytes32 => address) protocolAgents;

        uint256 withdrawTimeLock;
        uint256 withdrawClaimPeriod;

        mapping(bytes32 => bool) protocolsCovered;
    }

    function gs() internal pure returns (Base storage bs) {
        bytes32 position = GOV_STORAGE_POSITION;
        assembly {
            bs.slot := position
        }
    }
}
