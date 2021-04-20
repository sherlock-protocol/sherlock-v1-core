//SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;

interface ITimelock {
    function claimAllFor(address _user) external;

    function claimAllForMulti(address[] memory _users) external;
}
