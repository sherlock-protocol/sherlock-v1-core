//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.0;

import "hardhat/console.sol";

import "../interfaces/IStake.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library PoolStorage {

    struct Base {
        bool initialized;

        uint256 poolBalance;
        mapping(bytes32 => uint256) protocolBalance;
        mapping(bytes32 => uint256) protocolPremium;
        uint256 totalPremiumPerBlock;
        uint256 totalPremiumLastPaid;

        mapping(address => StakeWithdraw[]) stakesWithdraw;

        IStake stakeToken;
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