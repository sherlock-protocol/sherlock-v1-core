//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.4;
pragma abicoder v2;

import "hardhat/console.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../storage/LibPool.sol";
import "../storage/LibGov.sol";
import "../storage/LibTimelock.sol";

import "../interfaces/ITimelock.sol";

import "../libraries/LibPool.sol";

import "../libraries/LibERC20.sol";

contract TimelockFacet is ITimelock {
    function claimAllFor(address _user) public override {
        TimelockStorage.Base storage es = TimelockStorage.timelockStorage();

        for (uint256 i; i < es.entries[_user].length; i++) {
            uint256[2] storage entry = es.entries[_user][i];

            if (entry[0] == uint256(0)) {
                continue;
            }

            if (block.number >= entry[0]) {
                LibERC20.mint(_user, entry[1]);
                es.entries[_user][i] = [uint256(0), uint256(0)];
            }
        }
    }

    function claimAllForMulti(address[] memory _users) external override {
        for (uint256 i; i < _users.length; i++) {
            claimAllFor(_users[i]);
        }
    }

    // todo claim and swap
    // todo claim() for msg sender
    // view get total claimable
}
