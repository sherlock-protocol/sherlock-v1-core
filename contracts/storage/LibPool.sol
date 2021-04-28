//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "hardhat/console.sol";

import "../interfaces/IStake.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library PoolStorage {

    struct Base {
        address govPool;

        bool initialized;
        bool deposits;

        uint256 poolBalance;
        uint256 firstMoneyOut;
        uint256 unmaterializedFee;
        mapping(bytes32 => uint256) protocolBalance;
        mapping(bytes32 => uint256) protocolPremium;
        uint256 totalPremiumPerBlock;
        uint256 totalPremiumLastPaid;

        // how much token (this) is available for fee holders
        uint256 underlyingForFee;

        // non-native variables
        mapping(address => uint256) feeWithdrawn;
        uint256 feeWeight;
        uint256 totalFeePoolWeight;

        mapping(address => StakeWithdraw[]) stakesWithdraw;

        IStake stakeToken;

        mapping(bytes32 => bool) isProtocol;
        bytes32[] protocols;

        uint256 exitFee;
    }

    struct StakeWithdraw {
        uint256 blockInitiated;
        uint256 stake;
    }

    function ps(address _token) internal pure returns (Base storage bs) {
        bytes32 position = keccak256(abi.encode("diamond.sherlock.pool.", _token));
        assembly {
            bs.slot := position
        }
    }
}
