// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './interfaces/lock/INativeLock.sol';

contract NativeLock is ERC20, INativeLock, Ownable {
  constructor(
    string memory _name,
    string memory _symbol,
    address _sherlock
  ) public ERC20(_name, _symbol) {
    transferOwnership(_sherlock);
  }

  function getOwner() external view override returns (address) {
    return owner();
  }

  function mint(address _account, uint256 _amount) external override onlyOwner {
    _mint(_account, _amount);
  }

  function burn(address _account, uint256 _amount) external override onlyOwner {
    _burn(_account, _amount);
  }
}
