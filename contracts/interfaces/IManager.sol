// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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
