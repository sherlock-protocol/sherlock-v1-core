//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "hardhat/console.sol";

import "../interfaces/IStake.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library FeeStorage {
    bytes32 constant FEE_STORAGE_POSITION = keccak256(
        abi.encode("diamond.sherlock.fee")
    );

    struct Base {
        mapping(IERC20 => uint256) tokenUSD;
        uint256 totalBlockIncrement; // totalUsdPerBlock
        uint256 totalUsdPool;
        uint256 lastPremiumChange; // totalUsdLastSettled

        uint256 feePerBlock; // sherXPerBlock
        uint256 feeLastAccrued; // sherXLastAccrued

        uint256 totalFeePool; // TODO remove?
    }

    function fs() internal pure returns (Base storage fs) {
        bytes32 position = FEE_STORAGE_POSITION;
        assembly {
            fs.slot := position
        }
    }
}
