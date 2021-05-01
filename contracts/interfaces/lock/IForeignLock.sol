//SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;

import "./INativeLock.sol";

interface IForeignLock is INativeLock {
    function underlying() external view returns (address);
}
