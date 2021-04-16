//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.4;

import "hardhat/console.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../storage/LibPool.sol";
import "../storage/LibGov.sol";
import "../storage/LibERC20Storage.sol";

import "../interfaces/IFee.sol";
import "../interfaces/IStake.sol";

import "../libraries/LibPool.sol";
import "../libraries/LibFee.sol";
import "../libraries/LibERC20.sol";

contract Fee is IFee {
    using SafeMath for uint256;

    // todo harvest(address[]), loop over all tokens user holds and redeem fees

    function harvest(address _token) external override {
        harvestFor(_token, msg.sender);
    }

    function harvestFor(address _token, address _user) public override {
        doYield(_token, _user, _user, 0);
    }

    function harvestForMultiple(address _token, address[] memory _users)
        external
        override
    {
        for (uint256 i; i < _users.length; i++) {
            doYield(_token, _users[i], _users[i], 0);
        }
    }

    function setWeights(address[] memory _tokens, uint256[] memory _weights)
        external
        override
    {
        // TODO
        // setInitialWeight (set single pool to 100)
        // makes it easier to this loop, as the difference in weights has to be zero. (sums should still be 100)
        // or just do total weight (e.g not 100 total)
        LibFee.accrueFeeToken();

        require(_tokens.length == _weights.length, "L2");

        for (uint256 i; i < _tokens.length; i++) {
            PoolStorage.Base storage ps = PoolStorage.ps(_tokens[i]);

            ps.totalFeePoolWeight = _weights[i];
        }
    }

    function calcUnderylingInStoredUSD()
        external
        override
        view
        returns (uint256 usd)
    {
        FeeStorage.Base storage fs = FeeStorage.fs();
        GovStorage.Base storage gs = GovStorage.gs();
        LibERC20Storage.ERC20Storage storage es = LibERC20Storage
            .erc20Storage();

        for (uint256 i; i < gs.tokens.length; i++) {
            IERC20 token = gs.tokens[i];
            //LibPool.payOffDebtAll(token);

            PoolStorage.Base storage ps = PoolStorage.ps(address(token));
            usd = usd.add(
                ps
                    .underlyingForFee
                    .mul(es.balances[msg.sender])
                    .mul(fs.tokenUSD[token])
                    .div(es.totalSupply)
                    .div(10**18)
            );
        }
    }

    function calcUnderyling()
        external
        override
        view
        returns (IERC20[] memory tokens, uint256[] memory amounts)
    {
        FeeStorage.Base storage fs = FeeStorage.fs();
        GovStorage.Base storage gs = GovStorage.gs();
        LibERC20Storage.ERC20Storage storage es = LibERC20Storage
            .erc20Storage();

        tokens = new IERC20[](gs.tokens.length);
        amounts = new uint256[](gs.tokens.length);

        for (uint256 i; i < gs.tokens.length; i++) {
            IERC20 token = gs.tokens[i];
            //LibPool.payOffDebtAll(token);
            PoolStorage.Base storage ps = PoolStorage.ps(address(token));
            // todo include debt
            tokens[i] = token;
            amounts[i] = ps.underlyingForFee.mul(es.balances[msg.sender]).div(
                es.totalSupply
            );
        }
    }

    // TODO redeem()

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) external override {
        doYield(msg.sender, from, to, amount);
    }

    function doYield(
        address token,
        address from,
        address to,
        uint256 amount
    ) private {
        address underlying = IStake(token).underyling();
        PoolStorage.Base storage ps = PoolStorage.ps(underlying);
        require(address(ps.stakeToken) == token, "Unexpected sender");
        // mint / transfer FEE tokens, triggered by withdraw + transfer
        LibFee.accrueFeeToken();

        uint256 userAmount = ps.stakeToken.balanceOf(from);
        uint256 totalAmount = ps.stakeToken.totalSupply();

        uint256 ineglible_yield_amount;
        if (totalAmount > 0) {
            ineglible_yield_amount = ps.feeWeight.mul(amount).div(totalAmount);
        } else {
            ineglible_yield_amount = amount;
        }

        if (from != address(0)) {
            uint256 raw_amount = ps.feeWeight.mul(userAmount).div(totalAmount);
            uint256 withdrawable_amount = raw_amount.sub(ps.feeWithdrawn[from]);
            if (withdrawable_amount > 0) {
                // store the data in a single calc
                ps.feeWithdrawn[from] = raw_amount.sub(ineglible_yield_amount);
                ps.feeTotalWithdrawn = ps
                    .feeTotalWithdrawn
                    .add(withdrawable_amount)
                    .sub(ineglible_yield_amount);

                //ps.feePool = ps.feePool.sub(withdrawable_amount);
                LibERC20.mint(from, withdrawable_amount);
            } else {
                ps.feeWithdrawn[from] = ps.feeWithdrawn[from].sub(
                    ineglible_yield_amount
                );
                ps.feeTotalWithdrawn = ps.feeTotalWithdrawn.sub(
                    ineglible_yield_amount
                );
            }
        } else {
            ps.feeWeight = ps.feeWeight.add(ineglible_yield_amount);
        }

        if (to != address(0)) {
            ps.feeWithdrawn[to] = ps.feeWithdrawn[to].add(
                ineglible_yield_amount
            );
            ps.feeTotalWithdrawn = ps.feeTotalWithdrawn.add(
                ineglible_yield_amount
            );
        } else {
            ps.feeWeight = ps.feeWeight.sub(ineglible_yield_amount);
        }
    }
}
