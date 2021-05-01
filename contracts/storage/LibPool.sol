//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "hardhat/console.sol";

import "../interfaces/lock/INativeLock.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// TokenStorage
library PoolStorage {

    string constant POOL_STORAGE_PREFIX = "diamond.sherlock.pool.";

    struct Base {
        address govPool;

        bool initialized;
        // TODO find out how AlchemiX can pay a token, but people are not able to stake it
        bool stakes;

        uint256 stakeBalance;
        uint256 firstMoneyOut;
        uint256 unmaterializedSherX;
        mapping(bytes32 => uint256) protocolBalance;
        mapping(bytes32 => uint256) protocolPremium;
        uint256 totalPremiumPerBlock;
        uint256 totalPremiumLastPaid;

        // how much token (this) is available for sherX holders
        uint256 sherXUnderlying;

        // non-native variables
        mapping(address => uint256) sWithdrawn;
        uint256 sWeight;
        uint256 sherXWeight;

        mapping(address => UnstakeEntry[]) unstakeEntries;

        INativeLock stakeToken;

        mapping(bytes32 => bool) isProtocol;
        bytes32[] protocols;

        uint256 activateCooldownFee;
    }

    struct UnstakeEntry {
        uint256 blockInitiated;
        uint256 stake;
    }

    function ps(address _token) internal pure returns (Base storage bs) {
        bytes32 position = keccak256(abi.encode(POOL_STORAGE_PREFIX, _token));
        assembly {
            bs.slot := position
        }
    }
}
