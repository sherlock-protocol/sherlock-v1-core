// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '../interfaces/ILock.sol';

interface IRemove {
  function swap(
    IERC20,
    uint256,
    uint256,
    uint256
  )
    external
    returns (
      IERC20 newToken,
      uint256 newStakeBalance,
      uint256 newFmo,
      uint256 newSherxUnderlying
    );
}
