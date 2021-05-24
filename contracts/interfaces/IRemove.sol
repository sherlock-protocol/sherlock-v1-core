// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '../interfaces/ILock.sol';

interface IRemove {
  function swap(
    IERC20 _token,
    uint256 _fmo,
    uint256 _sherXUnderlying
  )
    external
    returns (
      IERC20 newToken,
      uint256 newFmo,
      uint256 newSherxUnderlying
    );
}
