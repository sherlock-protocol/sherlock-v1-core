//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "hardhat/console.sol";

import "../interfaces/stake/INativeStake.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library SherXStorage {
    bytes32 constant SHERX_STORAGE_POSITION = keccak256(
        "diamond.sherlock.x"
    );

    struct Base {
        mapping(IERC20 => uint256) tokenUSD;
        uint256 totalBlockIncrement; // totalUsdPerBlock
        uint256 totalUsdPool;
        uint256 lastPremiumChange; // totalUsdLastSettled

        uint256 feePerBlock; // sherXPerBlock
        uint256 feeLastAccrued; // sherXLastAccrued
    }

    function sx() internal pure returns (Base storage sx) {
        bytes32 position = SHERX_STORAGE_POSITION;
        assembly {
            sx.slot := position
        }
    }
}
