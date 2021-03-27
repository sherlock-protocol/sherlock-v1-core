//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "hardhat/console.sol";

library GovStorage {
    bytes32 constant GOV_STORAGE_POSITION = keccak256(abi.encode("diamond.sherlock.gov"));

    struct Base {
        address govInsurance;

        mapping(bytes32 => address) protocolManagers;
        mapping(bytes32 => address) protocolAgents;

        uint256 withdrawTimeLock;
        uint256 withdrawClaimPeriod;

        mapping(bytes32 => bool) protocolIsCovered;

        IERC20[] tokens;

        uint256 exitFee;
    }

    function gs() internal pure returns (Base storage bs) {
        bytes32 position = GOV_STORAGE_POSITION;
        assembly {
            bs.slot := position
        }
    }
}
