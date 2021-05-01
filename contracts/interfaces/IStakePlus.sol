//SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;

import "./IStake.sol";

interface IStakePlus is IStake {
    function underlying() external view returns (address);
}
