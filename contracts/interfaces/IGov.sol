// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.4;

import "../interfaces/stake/INativeStake.sol";

interface IGov {
    function setInitialGovInsurance(address _govInsurance) external;

    function transferGovInsurance(address _govInsurance) external;

    function getGovInsurance() external view returns (address);

    // setUnstakeWindow()
    function setClaimPeriod(uint256 _claimPeriod) external;

    // setCooldown()
    function setTimeLock(uint256 _timeLock) external;

    // same
    function getClaimPeriod() external view returns (uint256 claimPeriod);

    // same
    function getTimeLock() external view returns (uint256 timeLock);

    function getTokens() external view returns (IERC20[] memory tokens);

    function getProtocolIsCovered(bytes32 _protocol)
        external
        view
        returns (bool);

    function getProtocolManager(bytes32 _protocol)
        external
        view
        returns (address manager);

    function getProtocolAgent(bytes32 _protocol)
        external
        view
        returns (address agent);

    event TokenAdded(IERC20 _token, INativeStake _stake);

    function protocolAdd(
        bytes32 _protocol,
        address _eoaProtocolAgent,
        address _eoaManager
    ) external;

    function protocolUpdate(
        bytes32 _protocol,
        address _eoaProtocolAgent,
        address _eoaManager
    ) external;

    function protocolRemove(bytes32 _protocol) external;

    // TODO transfer govpool role
    function tokenAdd(
        IERC20 _token,
        INativeStake _stake,
        address _govPool
    ) external;

    function tokenDisable(IERC20 _token) external;

    function tokenRemove(
        IERC20 _token,
        uint256 _index,
        address _to
    ) external;

    function payout(
        address _payout,
        IERC20[] memory _tokens,
        uint256[] memory _firstMoneyOut,
        uint256[] memory _amounts,
        uint256[] memory _unmaterializedSherX
    ) external;
}
