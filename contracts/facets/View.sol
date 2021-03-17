//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.4;

import "hardhat/console.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../storage/LibPool.sol";
import "../storage/LibGov.sol";

import "../interfaces/IView.sol";

contract View is IView {
    function tokenIsSupported(address _token)
        external
        override
        view
        returns (bool supported)
    {
        supported = PoolStorage.ps(address(_token)).initialized;
    }
}
