import "hardhat/console.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../storage/LibGov.sol";
import "../storage/LibPool.sol";
import "../storage/LibFee.sol";

library LibPool {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using SafeERC20 for IStake;

    function stake(
        PoolStorage.Base storage ps,
        uint256 _amount,
        address _receiver
    ) external returns (uint256 stake) {
        uint256 totalStake = ps.stakeToken.totalSupply();
        if (totalStake == 0) {
            // mint initial stake
            stake = 10**18;
        } else {
            // mint stake based on funds in pool
            stake = _amount.mul(totalStake).div(ps.poolBalance);
        }
        ps.poolBalance = ps.poolBalance.add(_amount);
        ps.stakeToken.mint(_receiver, stake);
    }

    function withdraw(
        PoolStorage.Base storage ps,
        uint256 _amount,
        address _holder,
        address _receiver
    ) external returns (uint256) {
        /*
        X Stake token is transferred, this triggers the fee mint, deposit, withdrawal
        Reentry for fee stakeToken again. Once fee stakeTokek withdraw call is done
        It is continuing the exit fee calc for the X stake token.

        TODO make only this reentry possible or restructure.
        */
        ps.stakeToken.safeTransferFrom(_holder, address(this), _amount);
        uint256 stakeTokenExitFee = _amount.mul(ps.exitFee).div(10**18);
        if (stakeTokenExitFee > 0) {
            // stake of user gets burned
            // representative amount token get added to first money out pool
            uint256 tokenAmount = stakeTokenExitFee.mul(ps.poolBalance).div(
                ps.stakeToken.totalSupply()
            );
            ps.poolBalance = ps.poolBalance.sub(tokenAmount);
            ps.firstMoneyOut = ps.firstMoneyOut.add(tokenAmount);

            ps.stakeToken.burn(address(this), stakeTokenExitFee);
        }

        ps.stakesWithdraw[_receiver].push(
            PoolStorage.StakeWithdraw(
                block.number,
                _amount.sub(stakeTokenExitFee)
            )
        );

        return ps.stakesWithdraw[_receiver].length - 1;
    }

    function withdrawClaim(
        PoolStorage.Base storage ps,
        address _user,
        uint256 _id
    ) external returns (uint256 amount) {
        GovStorage.Base storage gs = GovStorage.gs();
        PoolStorage.StakeWithdraw memory withdraw = ps
            .stakesWithdraw[_user][_id];
        require(withdraw.blockInitiated != 0, "WITHDRAW_NOT_ACTIVE");
        // timelock is including
        require(
            withdraw.blockInitiated.add(gs.withdrawTimeLock) < block.number,
            "TIMELOCK_ACTIVE"
        );
        // claim period is including, TODO should it be including?
        require(
            withdraw.blockInitiated.add(gs.withdrawTimeLock).add(
                gs.withdrawClaimPeriod
            ) > block.number,
            "CLAIMPERIOD_EXPIRED"
        );
        amount = withdraw.stake.mul(ps.poolBalance).div(
            ps.stakeToken.totalSupply()
        );
        // TODO get fee tokens from timelock (and swap for native) (in timelock lib)
        ps.poolBalance = ps.poolBalance.sub(amount);
        ps.stakeToken.burn(address(this), withdraw.stake);
        // TODO send fee tokens
        delete ps.stakesWithdraw[_user][_id];
    }

    function payOffDebtAll(IERC20 _token) external {
        PoolStorage.Base storage ps = PoolStorage.ps(address(_token));
        for (uint256 i = 0; i < ps.protocols.length; i++) {
            payOffDebt(ps.protocols[i], _token);
        }

        uint256 totalAccruedDebt = getTotalAccruedDebt(_token);
        // move funds to the fee pool
        ps.underlyingForFee = ps.underlyingForFee.add(totalAccruedDebt);

        FeeStorage.Base storage fs = FeeStorage.fs();
        // changes the fs.totalUsdPool
        // fs.totalUsdPool = fs.totalUsdPool.add(
        //     totalAccruedDebt.mul(fs.tokenUSD[_token]).div(10**18)
        // );

        ps.totalPremiumLastPaid = block.number;
    }

    function payOffDebt(bytes32 _protocol, IERC20 _token) private {
        PoolStorage.Base storage ps = PoolStorage.ps(address(_token));
        // todo optimize by forwarding  block.number.sub(protocolPremiumLastPaid) instead of calculating every loop
        uint256 debt = accruedDebt(_protocol, _token);
        ps.protocolBalance[_protocol] = ps.protocolBalance[_protocol].sub(debt);
    }

    function accruedDebt(bytes32 _protocol, IERC20 _token)
        public
        view
        returns (uint256)
    {
        PoolStorage.Base storage ps = PoolStorage.ps(address(_token));

        return
            block.number.sub(ps.totalPremiumLastPaid).mul(
                ps.protocolPremium[_protocol]
            );
    }

    function getTotalAccruedDebt(IERC20 _token) public view returns (uint256) {
        PoolStorage.Base storage ps = PoolStorage.ps(address(_token));

        return
            block.number.sub(ps.totalPremiumLastPaid).mul(
                ps.totalPremiumPerBlock
            );
    }
}
