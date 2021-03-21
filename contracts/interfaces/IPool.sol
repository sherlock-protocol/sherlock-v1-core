//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.4;
pragma abicoder v2;

import "hardhat/console.sol";

import "../storage/LibPool.sol";
import "../storage/LibGov.sol";

interface IPool {
    function depositProtocolBalance(
        bytes32 _protocol,
        uint256 _amount,
        address _token
    ) external;

    function withdrawProtocolBalance(
        bytes32 _protocol,
        uint256 _amount,
        address _receiver,
        address _token
    ) external;

    function stake(
        uint256 _amount,
        address _receiver,
        address _token
    ) external returns (uint256);

    function withdrawStake(uint256 _amount, address _token)
        external
        returns (uint256);

    function withdrawCancel(uint256 _id, address _token) external;

    function withdrawPurge(
        address _account,
        uint256 _id,
        address _token
    ) external;

    function withdrawClaim(uint256 _id) external;

    function getWithdrawal(
        address _staker,
        uint256 _id,
        address _token
    ) external view returns (PoolStorage.StakeWithdraw memory);

    function getTotalAccruedDebt(address _token)
        external
        view
        returns (uint256);

    function getAccruedDebt(bytes32 _protocol, address _token)
        external
        view
        returns (uint256);

    function payOffDebtAll(address _token) external;

    function getTotalPremiumPerBlock(address _token)
        external
        view
        returns (uint256);

    function getWithdrawalSize(address _staker, address _token)
        external
        view
        returns (uint256);

    function getWithrawalInitialIndex(address _staker, address _token)
        external
        view
        returns (uint256);

    function getStakersTVL(address _token) external view returns (uint256);

    function getStakerTVL(address _staker, address _token)
        external
        view
        returns (uint256);

    function exchangeRate(address _token) external view returns (uint256);
}
