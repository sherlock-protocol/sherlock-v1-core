// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './interfaces/lock/IForeignLock.sol';
import './interfaces/lock/INativeLock.sol';
import './interfaces/ISherlock.sol';

import './NativeLock.sol';

contract ForeignLock is NativeLock, IForeignLock {
  address public override underlying;

  constructor(
    string memory _name,
    string memory _symbol,
    address _sherlock,
    address _underlying
  ) public NativeLock(_name, _symbol, _sherlock) {
    underlying = _underlying;
  }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal override {
    ISherlock(owner())._beforeTokenTransfer(from, to, amount);
  }
}
