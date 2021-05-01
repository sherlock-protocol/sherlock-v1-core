//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.4;

import "hardhat/console.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../interfaces/IPayout.sol";

import "../libraries/LibSherX.sol";
import "../libraries/LibSherXERC20.sol";

contract Payout is IPayout {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    function payout(
        address _payout,
        IERC20[] memory _tokens,
        uint256[] memory _firstMoneyOut,
        uint256[] memory _amounts,
        uint256[] memory _unmaterializedSherX
    ) external override {
        // all pools (including SherX pool) can be deducted fmo and balance
        // deducting balance will reduce the users underlying value of stake token
        // for every pool, _unmaterializedSherX can be deducted, this will decrease outstanding SherX rewards
        // for users that did not claim them (e.g materialized them and included in SherX pool)

        SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();
        SherXStorage.Base storage sx = SherXStorage.sx();

        // todo require all equal lengths

        LibSherX.accrueSherX();
        uint256 totalUnmaterializedFee = 0;

        for (uint256 i; i < _tokens.length; i++) {
            PoolStorage.Base storage ps = PoolStorage.ps(address(_tokens[i]));
            require(
                ps.unmaterializedSherX >= _unmaterializedSherX[i],
                "ERR_UNMAT_FEE"
            );
            ps.sWeight = ps.sWeight.sub(_unmaterializedSherX[i]);
            ps.firstMoneyOut = ps.firstMoneyOut.sub(_firstMoneyOut[i]);
            ps.stakeBalance = ps.stakeBalance.sub(_amounts[i]);

            totalUnmaterializedFee = totalUnmaterializedFee.add(
                _unmaterializedSherX[i]
            );

            uint256 total = _firstMoneyOut[i].add(_amounts[i]);
            if (total > 0) {
                _tokens[i].safeTransfer(_payout, total);
            }
        }
        if (totalUnmaterializedFee > 0) {
            LibSherXERC20.mint(_payout, totalUnmaterializedFee);
        }
    }
}
