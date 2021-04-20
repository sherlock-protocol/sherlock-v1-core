// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

import "../storage/LibTimelock.sol";
import "../storage/LibGov.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

library LibTimelock {
    using SafeMath for uint256;

    function lock(address _user, uint256 _amount) internal {
        GovStorage.Base storage gs = GovStorage.gs();
        TimelockStorage.Base storage es = TimelockStorage.timelockStorage();

        es.entries[_user].push(
            [block.number.add(gs.withdrawTimeLock), _amount]
        );
    }
}
