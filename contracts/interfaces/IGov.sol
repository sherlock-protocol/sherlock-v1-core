// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.4;

import "../storage/LibPool.sol";
import "../storage/LibGov.sol";

interface IGov {
    function setClaimPeriod(uint256 _claimPeriod) external;

    function setTimeLock(uint256 _timeLock) external;

    function getClaimPeriod() external view returns (uint256 claimPeriod);

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

    event TokenAdded(IERC20 _token, IStake _stake);

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

    function protocolRemove(bytes32 _protocol, address _receiver) external;

    function tokenAdd(
        IERC20 _token,
        IStake _stake,
        address _govPool
    ) external;

    function tokenDisable(IERC20 _token) external;

    function tokenRemove(
        IERC20 _token,
        uint256 _index,
        address _to
    ) external;
}
