// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.4;

import "../storage/LibPool.sol";
import "../storage/LibGov.sol";

interface IManager {
    function setProtocolPremiums(
        bytes32 _protocol,
        IERC20[] memory _token,
        uint256[] memory _premium,
        uint256[] memory _price
    ) external;

    function setProtocolPremium(
        bytes32 _protocol,
        IERC20 _token,
        uint256 _premium,
        uint256 _price
    ) external;
}
