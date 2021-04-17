//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.4;

import "hardhat/console.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../storage/LibPool.sol";
import "../storage/LibGov.sol";

import "../interfaces/IFee.sol";
import "../interfaces/IStake.sol";

import "./LibPool.sol";

library LibFee {
    using SafeMath for uint256;

    // TODO accureFeeToken(address token), to just accrue for a certain token
    // do accrueFeeToken() to loop over all if updating weights

    function accrueFeeToken() external {
        // loop over pools, increase the pool + pool_weight based on the distribution weights

        GovStorage.Base storage gs = GovStorage.gs();
        FeeStorage.Base storage fs = FeeStorage.fs();

        // mint fee tokens op basis van (fs.feePerBlock) diff
        uint256 amount = block.number.sub(fs.feeLastAccrued).mul(
            fs.feePerBlock
        );
        if (amount == 0) {
            return;
        }

        for (uint256 i; i < gs.tokens.length; i++) {
            IERC20 token = gs.tokens[i];

            PoolStorage.Base storage ps = PoolStorage.ps(address(token));

            uint256 fee = amount.mul(ps.totalFeePoolWeight).div(10**18);
            ps.feeWeight = ps.feeWeight.add(fee);
            ps.feePool = ps.feePool.add(fee);
            fs.totalFeePool = fs.totalFeePool.add(fee);
        }

        fs.feeLastAccrued = block.number;
    }
}
