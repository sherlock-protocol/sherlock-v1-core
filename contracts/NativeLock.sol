// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/lock/INativeLock.sol";
import "./interfaces/ISolution.sol";

contract NativeLock is ERC20, INativeLock, Ownable {
    constructor(string memory name_, string memory symbol_)
        public
        ERC20(name_, symbol_)
    {}

    function getOwner() external override view returns (address) {
        return owner();
    }

    function mint(address _account, uint256 _amount)
        external
        override
        onlyOwner
    {
        _mint(_account, _amount);
    }

    function burn(address _account, uint256 _amount)
        external
        override
        onlyOwner
    {
        _burn(_account, _amount);
    }
}
