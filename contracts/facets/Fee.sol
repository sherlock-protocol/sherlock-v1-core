//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.4;

import "hardhat/console.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../interfaces/IFee.sol";
import "../interfaces/IStake.sol";
import "../interfaces/IStakePlus.sol";

import "../libraries/LibPool.sol";
import "../libraries/LibFee.sol";
import "../libraries/LibERC20.sol";

import "../storage/LibERC20Storage.sol";

contract Fee is IFee {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // todo harvest(address[]), loop over all tokens user holds and redeem fees

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
            address underlying = IStakePlus(_debtTokens[i]).underlying();
            LibPool.payOffDebtAll(IERC20(underlying));
        }
    }

    function harvestForMultiple(address _token, address[] memory _users)
        public
        override
    {
        address underlying = IStakePlus(_token).underlying();
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
        LibFee.accrueFeeToken();

        require(_tokens.length == _weights.length, "L2");

        for (uint256 i; i < _tokens.length; i++) {
            PoolStorage.Base storage ps = PoolStorage.ps(_tokens[i]);

            ps.totalFeePoolWeight = _weights[i];
        }
    }

    function calcUnderlyingInStoredUSDFor(uint256 _amount)
        public
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

            // TODO callstack
            PoolStorage.Base storage ps = PoolStorage.ps(address(token));
            uint256 _temp = ps.underlyingForFee.mul(_amount).mul(
                fs.tokenUSD[token]
            );
            _temp = _temp.div(10**18).div(es.totalSupply);

            usd = usd.add(_temp);
        }
    }

    function calcUnderlyingInStoredUSD()
        external
        override
        view
        returns (uint256 usd)
    {
        LibERC20Storage.ERC20Storage storage es = LibERC20Storage
            .erc20Storage();
        usd = calcUnderlyingInStoredUSDFor(es.balances[msg.sender]);
    }

    function calcUnderlying()
        external
        override
        view
        returns (IERC20[] memory tokens, uint256[] memory amounts)
    {
        LibERC20Storage.ERC20Storage storage es = LibERC20Storage
            .erc20Storage();

        return calcUnderlying(es.balances[msg.sender]);
    }

    function calcUnderlying(address _user)
        external
        override
        view
        returns (IERC20[] memory tokens, uint256[] memory amounts)
    {
        LibERC20Storage.ERC20Storage storage es = LibERC20Storage
            .erc20Storage();

        return calcUnderlying(es.balances[_user]);
    }

    function calcUnderlying(uint256 _amount)
        public
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
            amounts[i] = ps.underlyingForFee.mul(_amount).div(es.totalSupply);
        }
    }

    function redeem(uint256 _amount, address _receiver) external override {
        FeeStorage.Base storage fs = FeeStorage.fs();
        LibFee.accrueUSDPool();

        (IERC20[] memory tokens, uint256[] memory amounts) = calcUnderlying(
            _amount
        );

        for (uint256 i; i < tokens.length; i++) {
            PoolStorage.Base storage ps = PoolStorage.ps(address(tokens[i]));
            ps.underlyingForFee = ps.underlyingForFee.sub(amounts[i]);

            LibPool.payOffDebtAll(tokens[i]);
            // TODO, deduct?
            // ps.feeWeight
            fs.totalUsdPool = fs.totalUsdPool.sub(
                amounts[i].mul(fs.tokenUSD[tokens[i]]).div(10**18)
            );

            tokens[i].safeTransfer(_receiver, amounts[i]);
        }
        LibERC20.burn(msg.sender, _amount);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) external override {
        doYield(msg.sender, from, to, amount);
    }

    // TODO need to make sure this matches the actual fee amount
    function getWithdrawableFeeAmount(address _user, address _token)
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
        uint256 outstanding = LibFee.getOutstandingFeeTokens(_token);
        uint256 raw_amount = ps.feeWeight.add(outstanding).mul(userAmount).div(
            totalAmount
        );
        withdrawable_amount = raw_amount.sub(ps.feeWithdrawn[_user]);
    }

    function doYield(
        address token,
        address from,
        address to,
        uint256 amount
    ) private {
        address underlying = IStakePlus(token).underlying();
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

                ps.unmaterializedFee = ps.unmaterializedFee.sub(
                    withdrawable_amount
                );
                PoolStorage.Base storage psFee = PoolStorage.ps(address(this));
                if (from == address(this)) {
                    // add fee harvested by the pool itself to first money out pool.
                    psFee.firstMoneyOut = psFee.firstMoneyOut.add(
                        withdrawable_amount
                    );
                } else {
                    LibPool.stake(psFee, withdrawable_amount, from);
                }
            } else {
                ps.feeWithdrawn[from] = ps.feeWithdrawn[from].sub(
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
        } else {
            ps.feeWeight = ps.feeWeight.sub(ineglible_yield_amount);
        }
    }
}
