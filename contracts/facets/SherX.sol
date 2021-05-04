// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import "hardhat/console.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../interfaces/ISherX.sol";
import "../interfaces/lock/INativeLock.sol";
import "../interfaces/lock/IForeignLock.sol";

import "../libraries/LibPool.sol";
import "../libraries/LibSherX.sol";
import "../libraries/LibSherXERC20.sol";

import "../storage/LibSherXERC20.sol";

contract SherX is ISherX {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    //
    // View methods
    //

    function calcUnderlying()
        external
        override
        view
        returns (IERC20[] memory tokens, uint256[] memory amounts)
    {
        SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();

        return calcUnderlying(sx20.balances[msg.sender]);
    }

    function calcUnderlying(uint256 _amount)
        public
        override
        view
        returns (IERC20[] memory tokens, uint256[] memory amounts)
    {
        //SherXStorage.Base storage sx = SherXStorage.sx();
        GovStorage.Base storage gs = GovStorage.gs();
        SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();

        tokens = new IERC20[](gs.tokens.length);
        amounts = new uint256[](gs.tokens.length);

        for (uint256 i; i < gs.tokens.length; i++) {
            IERC20 token = gs.tokens[i];
            //LibPool.payOffDebtAll(token);
            PoolStorage.Base storage ps = PoolStorage.ps(address(token));
            // todo include debt
            tokens[i] = token;
            // TODO add sherXUnderlying and blockIncrement
            // TODO add totalSupply rolling amount (per block)
            if (sx20.totalSupply > 0) {
                amounts[i] = ps.sherXUnderlying.mul(_amount).div(
                    sx20.totalSupply
                );
            } else {
                amounts[i] = 0;
            }
        }
    }

    function calcUnderlying(address _user)
        external
        override
        view
        returns (IERC20[] memory tokens, uint256[] memory amounts)
    {
        SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();

        return calcUnderlying(sx20.balances[_user]);
    }

    function calcUnderlyingInStoredUSD()
        external
        override
        view
        returns (uint256)
    {
        SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();
        return calcUnderlyingInStoredUSD(sx20.balances[msg.sender]);
    }

    function calcUnderlyingInStoredUSD(uint256 _amount)
        public
        override
        view
        returns (uint256 usd)
    {
        SherXStorage.Base storage sx = SherXStorage.sx();
        GovStorage.Base storage gs = GovStorage.gs();
        SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();

        for (uint256 i; i < gs.tokens.length; i++) {
            IERC20 token = gs.tokens[i];
            //LibPool.payOffDebtAll(token);

            // TODO callstack
            PoolStorage.Base storage ps = PoolStorage.ps(address(token));
            uint256 _temp = ps.sherXUnderlying.mul(_amount).mul(
                sx.tokenUSD[token]
            );
            _temp = _temp.div(10**18).div(sx20.totalSupply);

            usd = usd.add(_temp);
        }
    }

    //
    // State changing methods
    //

    function redeem(uint256 _amount, address _receiver) external override {
        require(_amount > 0, "AMOUNT");
        require(_receiver != address(0), "RECEIVER");

        SherXStorage.Base storage sx = SherXStorage.sx();
        LibSherX.accrueUSDPool();
        // TODO get last amount of FEE tokens (accrue)
        // TODO get last amount sherXUnderlying

        (IERC20[] memory tokens, uint256[] memory amounts) = calcUnderlying(
            _amount
        );

        for (uint256 i; i < tokens.length; i++) {
            PoolStorage.Base storage ps = PoolStorage.ps(address(tokens[i]));
            ps.sherXUnderlying = ps.sherXUnderlying.sub(amounts[i]);

            LibPool.payOffDebtAll(tokens[i]);
            // TODO, deduct?
            // ps.sWeight
            sx.totalUsdPool = sx.totalUsdPool.sub(
                amounts[i].mul(sx.tokenUSD[tokens[i]]).div(10**18)
            );

            tokens[i].safeTransfer(_receiver, amounts[i]);
        }
        LibSherXERC20.burn(msg.sender, _amount);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) external override {
        doYield(msg.sender, from, to, amount);
    }

    function harvest() external override {
        harvestFor(msg.sender);
    }

    function harvest(address _token) external override {
        harvestFor(msg.sender, _token);
    }

    function harvest(address[] calldata _tokens) external override {
        for (uint256 i; i < _tokens.length; i++) {
            harvestFor(msg.sender, _tokens[i]);
        }
    }

    function harvestFor(address _user) public override {
        GovStorage.Base storage gs = GovStorage.gs();
        for (uint256 i; i < gs.tokens.length; i++) {
            PoolStorage.Base storage ps = PoolStorage.ps(address(gs.tokens[i]));
            harvestFor(_user, address(ps.lockToken));
        }
    }

    function harvestFor(address _user, address _token) public override {
        // could potentially call harvest function for token that are not in the pool
        // if balance > 0, tx will revert
        uint256 stakeBalance = IERC20(_token).balanceOf(_user);
        if (stakeBalance > 0) {
            doYield(_token, _user, _user, 0);
        }
    }

    function harvestFor(address _user, address[] calldata _tokens)
        external
        override
    {
        for (uint256 i; i < _tokens.length; i++) {
            harvestFor(_user, _tokens[i]);
        }
    }

    function setInitialWeight(address _token) external override {
        require(_token != address(0), "TOKEN");

        GovStorage.Base storage gs = GovStorage.gs();
        bool set;

        for (uint256 i; i < gs.tokens.length; i++) {
            address token = address(gs.tokens[i]);
            PoolStorage.Base storage ps = PoolStorage.ps(token);
            require(ps.sherXWeight == 0, "ALREADY_INIT");

            if (token == _token) {
                // 100% to token
                set = true;
                ps.sherXWeight = 10**18;
            }
        }

        require(set, "SET");
    }

    function setWeights(address[] memory _tokens, uint256[] memory _weights)
        external
        override
    {
        require(_tokens.length == _weights.length, "LENGTH");
        LibSherX.accrueSherX();

        uint256 weightAdd;
        uint256 weightSub;

        for (uint256 i; i < _tokens.length; i++) {
            PoolStorage.Base storage ps = PoolStorage.ps(_tokens[i]);
            require(ps.initialized, "INIT");

            weightAdd = weightAdd.add(_weights[i]);
            weightSub = weightSub.add(ps.sherXWeight);
            ps.sherXWeight = _weights[i];
        }

        require(weightAdd == weightSub, "SUM");
    }

    function doYield(
        address token,
        address from,
        address to,
        uint256 amount
    ) private {
        address underlying = IForeignLock(token).underlying();
        PoolStorage.Base storage ps = PoolStorage.ps(underlying);
        require(address(ps.lockToken) == token, "Unexpected sender");

        LibSherX.accrueSherX();

        uint256 userAmount = ps.lockToken.balanceOf(from);
        uint256 totalAmount = ps.lockToken.totalSupply();

        uint256 ineglible_yield_amount;
        if (totalAmount > 0) {
            ineglible_yield_amount = ps.sWeight.mul(amount).div(totalAmount);
        } else {
            ineglible_yield_amount = amount;
        }

        if (from != address(0)) {
            uint256 raw_amount = ps.sWeight.mul(userAmount).div(totalAmount);
            uint256 withdrawable_amount = raw_amount.sub(ps.sWithdrawn[from]);
            if (withdrawable_amount > 0) {
                // store the data in a single calc
                ps.sWithdrawn[from] = raw_amount.sub(ineglible_yield_amount);

                ps.unmaterializedSherX = ps.unmaterializedSherX.sub(
                    withdrawable_amount
                );
                PoolStorage.Base storage psFee = PoolStorage.ps(address(this));
                if (from == address(this)) {
                    // add SherX harvested by the pool itself to first money out pool.
                    psFee.firstMoneyOut = psFee.firstMoneyOut.add(
                        withdrawable_amount
                    );
                } else {
                    LibPool.stake(psFee, withdrawable_amount, from);
                }
            } else {
                ps.sWithdrawn[from] = ps.sWithdrawn[from].sub(
                    ineglible_yield_amount
                );
            }
        } else {
            ps.sWeight = ps.sWeight.add(ineglible_yield_amount);
        }

        if (to != address(0)) {
            ps.sWithdrawn[to] = ps.sWithdrawn[to].add(ineglible_yield_amount);
        } else {
            ps.sWeight = ps.sWeight.sub(ineglible_yield_amount);
        }
    }
}
