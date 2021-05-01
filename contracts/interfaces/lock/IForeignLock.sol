//SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import "./INativeLock.sol";

interface IForeignLock is INativeLock {
    function underlying() external view returns (address);
}
