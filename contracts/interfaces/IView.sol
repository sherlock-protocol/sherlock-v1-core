//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.4;

import "hardhat/console.sol";

interface IView {
    function tokenIsSupported(address _token) external view returns (bool);
}
