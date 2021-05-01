//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.4;

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

    // todo harvest(address[]), loop over all tokens user holds and redeem SherXs

    function harvest(address _token) external override {
        harvestFor(_token, msg.sender);
    }

    function harvestFor(address _token, address _user) public override {
        doYield(_token, _user, _user, 0);
    }

    function harvestForMultipleMulti(
        address[] memory _token,
        address[] memory _users,
        address[] memory _debtTokens
    ) external override {
        for (uint256 i; i < _token.length; i++) {
            harvestForMultiple(_token[i], _users);
        }
        for (uint256 i; i < _debtTokens.length; i++) {
            address underlying = IForeignLock(_debtTokens[i]).underlying();
            LibPool.payOffDebtAll(IERC20(underlying));
        }
    }

    function harvestForMultiple(address _token, address[] memory _users)
        public
        override
    {
        address underlying = IForeignLock(_token).underlying();
        LibPool.payOffDebtAll(IERC20(underlying));
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
        LibSherX.accrueSherX();

        require(_tokens.length == _weights.length, "L2");

        for (uint256 i; i < _tokens.length; i++) {
            PoolStorage.Base storage ps = PoolStorage.ps(_tokens[i]);

            ps.sherXWeight = _weights[i];
        }
    }

    function calcUnderlyingInStoredUSDFor(uint256 _amount)
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

    function calcUnderlyingInStoredUSD()
        external
        override
        view
        returns (uint256 usd)
    {
        SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();
        usd = calcUnderlyingInStoredUSDFor(sx20.balances[msg.sender]);
    }

    function calcUnderlying()
        external
        override
        view
        returns (IERC20[] memory tokens, uint256[] memory amounts)
    {
        SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();

        return calcUnderlying(sx20.balances[msg.sender]);
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

    function calcUnderlying(uint256 _amount)
        public
        override
        view
        returns (IERC20[] memory tokens, uint256[] memory amounts)
    {
        SherXStorage.Base storage sx = SherXStorage.sx();
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
            amounts[i] = ps.sherXUnderlying.mul(_amount).div(sx20.totalSupply);
        }
    }

    function redeem(uint256 _amount, address _receiver) external override {
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

    // TODO need to make sure this matches the actual fee amount
    function getTotalUnmaterializedSherX(address _user, address _token)
        external
        override
        view
        returns (uint256 withdrawable_amount)
    {
        PoolStorage.Base storage ps = PoolStorage.ps(_token);

        uint256 userAmount = ps.stakeToken.balanceOf(_user);
        uint256 totalAmount = ps.stakeToken.totalSupply();
        if (totalAmount == 0) {
            return 0;
        }
        uint256 outstanding = LibSherX.getUnmintedSherX(_token);
        uint256 raw_amount = ps.sWeight.add(outstanding).mul(userAmount).div(
            totalAmount
        );
        withdrawable_amount = raw_amount.sub(ps.sWithdrawn[_user]);
    }

    function doYield(
        address token,
        address from,
        address to,
        uint256 amount
    ) private {
        address underlying = IForeignLock(token).underlying();
        PoolStorage.Base storage ps = PoolStorage.ps(underlying);
        require(address(ps.stakeToken) == token, "Unexpected sender");

        LibSherX.accrueSherX();

        uint256 userAmount = ps.stakeToken.balanceOf(from);
        uint256 totalAmount = ps.stakeToken.totalSupply();

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
