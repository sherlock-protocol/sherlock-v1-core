//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "hardhat/console.sol";

import "../interfaces/IStake.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// TokenStorage
library PoolStorage {

    struct Base {
        address govPool;

        bool initialized;
        // TODO sherx token? Not able to deposit? e.g. alchemix token
        // stakes
        bool deposits;

        uint256 poolBalance; // stakeBalance
        uint256 firstMoneyOut;
        uint256 unmaterializedFee; // sherx
        mapping(bytes32 => uint256) protocolBalance;
        mapping(bytes32 => uint256) protocolPremium;
        uint256 totalPremiumPerBlock;
        uint256 totalPremiumLastPaid;

        // how much token (this) is available for fee holders
        uint256 underlyingForFee; // sherXUnderlying

        // non-native variables
        mapping(address => uint256) feeWithdrawn; // sherXWithdrawn
        uint256 feeWeight; // sherXWeight
        uint256 totalFeePoolWeight; // sherXWeight

        mapping(address => StakeWithdraw[]) stakesWithdraw; // unstakeEntry

        IStake stakeToken;

        mapping(bytes32 => bool) isProtocol;
        bytes32[] protocols;

        uint256 exitFee; // activateCooldownFee
    }

    // TODO use uint256[2] instead of struct
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
