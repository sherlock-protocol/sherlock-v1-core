//SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;

import "./INativeStake.sol";

interface IForeignStake is INativeStake {
    function underlying() external view returns (address);
}
