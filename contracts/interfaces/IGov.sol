// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.4;

import "../storage/LibPool.sol";
import "../storage/LibGov.sol";

interface IGov {
    function setClaimPeriod(uint256 _claimPeriod) external;

    function setTimeLock(uint256 _timeLock) external;

    function getClaimPeriod() external view returns (uint256 claimPeriod);

    function getTimeLock() external view returns (uint256 timeLock);

    event TokenAdded(IERC20 _token, IStake _stake);

    function protocolAdd(
        bytes32 _protocol,
        address _eoaProtocolAgent,
        address _eoaManager
    ) external;

    function tokenAdd(IERC20 _token, IStake _stake) external;
}
