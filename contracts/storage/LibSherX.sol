//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import "hardhat/console.sol";

import "../interfaces/lock/INativeLock.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library SherXStorage {
    bytes32 constant SHERX_STORAGE_POSITION = keccak256(
        "diamond.sherlock.x"
    );

    struct Base {
        mapping(IERC20 => uint256) tokenUSD;
        uint256 totalUsdPerBlock;
        uint256 totalUsdPool;
        uint256 totalUsdLastSettled;

        uint256 sherXPerBlock;
        uint256 sherXLastAccrued;
    }

    function sx() internal pure returns (Base storage sx) {
        bytes32 position = SHERX_STORAGE_POSITION;
        assembly {
            sx.slot := position
        }
    }
}
