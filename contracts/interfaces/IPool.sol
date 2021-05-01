//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.4;
pragma abicoder v2;

import "../storage/LibPool.sol";

interface IPool {
    // setCooldownFee
    function setExitFee(uint256 _fee, address _token) external;

    function getExitFee(address _token) external view returns (uint256);

    function getGovPool(address _token) external view returns (address);

    function isInitialized(address _token) external view returns (bool);

    // isStake()
    function isDeposit(address _token) external view returns (bool);

    function getProtocolBalance(bytes32 _protocol, address _token)
        external
        view
        returns (uint256);

    function getProtocolPremium(bytes32 _protocol, address _token)
        external
        view
        returns (uint256);

    // getLockToken()
    function getStakeToken(address _token) external view returns (address);

    function isProtocol(bytes32 _protocol, address _token)
        external
        view
        returns (bool);

    function getProtocols(address _token)
        external
        view
        returns (bytes32[] memory);

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

    // activateCooldown()
    function withdrawStake(uint256 _amount, address _token)
        external
        returns (uint256);

    // cancelCooldown()
    function withdrawCancel(uint256 _id, address _token) external;

    // unstakeWindowExpiry()
    function withdrawPurge(
        address _account,
        uint256 _id,
        address _token
    ) external;

    // unstake()
    function withdrawClaim(
        uint256 _id,
        address _receiver,
        address _token
    ) external returns (uint256 amount);

    // getUnstakeEntry
    function getWithdrawal(
        address _staker,
        uint256 _id,
        address _token
    ) external view returns (PoolStorage.UnstakeEntry memory); // uint256[2]

    function getTotalAccruedDebt(address _token)
        external
        view
        returns (uint256);

    function getFirstMoneyOut(address _token) external view returns (uint256);

    function getAccruedDebt(bytes32 _protocol, address _token)
        external
        view
        returns (uint256);

    function payOffDebtAll(address _token) external;

    function getTotalPremiumPerBlock(address _token)
        external
        view
        returns (uint256);

    function getPremiumLastPaid(address _token) external view returns (uint256);

    // getUnstakeEntrySize()
    function getWithdrawalSize(address _staker, address _token)
        external
        view
        returns (uint256);

    // getInitialUnstakeEntry()
    function getWithrawalInitialIndex(address _staker, address _token)
        external
        view
        returns (uint256);

    // getStakersPoolBalance()
    function getStakersTVL(address _token) external view returns (uint256);

    // getStakerPoolBalance()
    function getStakerTVL(address _staker, address _token)
        external
        view
        returns (uint256);

    // function stakeToToken(uint256 _amount, address _token)
    //     external
    //     view
    //     returns (uint256);

    // xRateLockToToken
    // xRateTokenToLock
    function exchangeRate(address _token) external view returns (uint256);

    function removeProtocol(
        bytes32 _protocol,
        uint256 _index,
        bool _forceDebt,
        address _receiver,
        address _token
    ) external;

    // getUnmaterializedSherX
    function getUnmaterializedFee(address _token)
        external
        view
        returns (uint256);
}
