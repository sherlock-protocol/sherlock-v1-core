//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.4;

import "hardhat/console.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../storage/LibPool.sol";
import "../libraries/LibSherXERC20.sol";
import "../storage/LibGov.sol";

import "../interfaces/ISherX.sol";
import "../interfaces/stake/INativeStake.sol";

import "./LibPool.sol";

library LibSherX {
    using SafeMath for uint256;

    // TODO accureFeeToken(address token), to just accrue for a certain token
    // do accrueFeeToken() to loop over all if updating weights

    function accrueUSDPool() external {
        SherXStorage.Base storage sx = SherXStorage.sx();
        sx.totalUsdPool = sx.totalUsdPool.add(
            block.number.sub(sx.lastPremiumChange).mul(sx.totalBlockIncrement)
        );
        sx.lastPremiumChange = block.number;
    }

    // TODO remove?
    function getOutstandingFeeTokens(address _token)
        external
        view
        returns (uint256 fee)
    {
        SherXStorage.Base storage sx = SherXStorage.sx();
        uint256 amount = block.number.sub(sx.feeLastAccrued).mul(
            sx.feePerBlock
        );

        PoolStorage.Base storage ps = PoolStorage.ps(_token);
        fee = amount.mul(ps.totalFeePoolWeight).div(10**18);
    }

    function accrueFeeToken() external {
        // loop over pools, increase the pool + pool_weight based on the distribution weights

        GovStorage.Base storage gs = GovStorage.gs();
        SherXStorage.Base storage sx = SherXStorage.sx();

        // mint fee tokens op basis van (sx.feePerBlock) diff

        uint256 amount = block.number.sub(sx.feeLastAccrued).mul(
            sx.feePerBlock
        );
        if (amount == 0) {
            return;
        }

        for (uint256 i; i < gs.tokens.length; i++) {
            IERC20 token = gs.tokens[i];

            PoolStorage.Base storage ps = PoolStorage.ps(address(token));

            uint256 fee = amount.mul(ps.totalFeePoolWeight).div(10**18);
            if (address(token) == address(this)) {
                ps.poolBalance = ps.poolBalance.add(fee);
            } else {
                ps.unmaterializedFee = ps.unmaterializedFee.add(fee);
                ps.feeWeight = ps.feeWeight.add(fee);
            }
        }
        LibSherXERC20.mint(address(this), amount);
        sx.feeLastAccrued = block.number;
    }
}
