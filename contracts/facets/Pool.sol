//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.4;
pragma abicoder v2;

import "hardhat/console.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../storage/LibPool.sol";
import "../storage/LibGov.sol";

import "../interfaces/IStake.sol";

contract Pool {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using SafeERC20 for IStake;

    function depositProtocolBalance(bytes32 _protocol, uint256 _amount)
        external
    {
        require(_amount > 0, "AMOUNT");
        require(
            GovStorage.gs().protocolAgents[_protocol] != address(0),
            "PROTOCOL"
        );
        (IERC20 token, PoolStorage.Base storage ps) = baseData();

        token.safeTransferFrom(msg.sender, address(this), _amount);
        ps.protocolBalance[_protocol] = ps.protocolBalance[_protocol].add(
            _amount
        );
    }

    function withdrawProtocolBalance(
        bytes32 _protocol,
        uint256 _amount,
        address _receiver
    ) external {
        require(
            msg.sender == GovStorage.gs().protocolAgents[_protocol],
            "SENDER"
        );
        require(_amount > 0, "AMOUNT");
        require(_receiver != address(0), "RECEIVER");
        (IERC20 token, PoolStorage.Base storage ps) = baseData();

        token.safeTransfer(_receiver, _amount);
        ps.protocolBalance[_protocol] = ps.protocolBalance[_protocol].sub(
            _amount
        );
    }

    function exchangeRate() external view returns (uint256 rate) {
        // token to stakedtoken
        (, PoolStorage.Base storage ps) = baseData();
        uint256 totalStake = ps.stakeToken.totalSupply();
        if (totalStake == 0) {
            rate = 10**18;
        } else {
            rate = totalStake.mul(10**18).div(ps.poolBalance);
        }
    }

    function getTotalPremiumPerBlock() external view returns (uint256) {
        (, PoolStorage.Base storage ps) = baseData();
        return ps.totalPremiumPerBlock;
    }

    function getStakersTVL() external view returns (uint256) {
        (, PoolStorage.Base storage ps) = baseData();
        return ps.poolBalance;
    }

    function getStakerTVL(address _staker) external view returns (uint256) {
        (, PoolStorage.Base storage ps) = baseData();
        if (ps.stakeToken.totalSupply() == 0) {
            return 0;
        }
        return
            ps.stakeToken.balanceOf(_staker).mul(ps.poolBalance).div(
                ps.stakeToken.totalSupply()
            );
    }

    function stake(uint256 _amount, address _receiver)
        external
        returns (uint256 stake)
    {
        require(_amount > 0, "AMOUNT");
        require(_receiver != address(0), "RECEIVER");
        (IERC20 token, PoolStorage.Base storage ps) = baseData();

        token.safeTransferFrom(msg.sender, address(this), _amount);
        ps.poolBalance = ps.poolBalance.add(_amount);

        uint256 totalStake = ps.stakeToken.totalSupply();
        if (totalStake == 0) {
            // mint initial stake
            stake = 10**18;
        } else {
            // mint stake based on funds in pool
            stake = _amount.mul(totalStake).div(ps.poolBalance);
        }
        ps.stakeToken.mint(_receiver, stake);
    }

    function withdrawStake(uint256 _amount) external returns (uint256) {
        require(_amount > 0, "AMOUNT");
        (IERC20 token, PoolStorage.Base storage ps) = baseData();
        ps.stakeToken.safeTransferFrom(msg.sender, address(this), _amount);
        ps.stakesWithdraw[msg.sender].push(
            PoolStorage.StakeWithdraw(
                block.number,
                _amount /* sub exit fee */
            )
        );
        // TODO burn 1% of stake tokens for exit fee
        return ps.stakesWithdraw[msg.sender].length - 1;
    }

    function withdrawCancel(uint256 _id) external {
        (IERC20 token, PoolStorage.Base storage ps) = baseData();
        GovStorage.Base storage gs = GovStorage.gs();

        PoolStorage.StakeWithdraw memory withdraw = ps.stakesWithdraw[msg
            .sender][_id];
        require(
            withdraw.blockInitiated.add(gs.withdrawTimeLock) > block.number,
            "TIMELOCK_EXPIRED"
        );
        ps.stakeToken.safeTransfer(msg.sender, withdraw.stake);
        delete ps.stakesWithdraw[msg.sender][_id];
    }

    function withdrawPurge(address _account, uint256 _id) external {
        (IERC20 token, PoolStorage.Base storage ps) = baseData();
        GovStorage.Base storage gs = GovStorage.gs();

        PoolStorage.StakeWithdraw memory withdraw = ps
            .stakesWithdraw[_account][_id];

        require(
            withdraw.blockInitiated.add(gs.withdrawTimeLock).add(
                gs.withdrawClaimPeriod
            ) > block.number,
            "CLAIMPERIOD_NOT_EXPIRED"
        );
        ps.stakeToken.safeTransfer(_account, withdraw.stake);
        delete ps.stakesWithdraw[_account][_id];
    }

    function withdrawClaim(uint256 _id) external {
        (IERC20 token, PoolStorage.Base storage ps) = baseData();
        GovStorage.Base storage gs = GovStorage.gs();

        PoolStorage.StakeWithdraw memory withdraw = ps.stakesWithdraw[msg
            .sender][_id];

        require(withdraw.blockInitiated != 0, "WITHDRAW_NOT_ACTIVE");
        // timelock is including
        require(
            withdraw.blockInitiated.add(gs.withdrawTimeLock) <= block.number,
            "TIMELOCK_ACTIVE"
        );
        // claim period is including
        require(
            withdraw.blockInitiated.add(gs.withdrawTimeLock).add(
                gs.withdrawClaimPeriod
            ) >= block.number,
            "CLAIMPERIOD_EXPIRED"
        );
        uint256 amount = withdraw.stake.mul(ps.poolBalance).div(
            ps.stakeToken.totalSupply()
        );
        token.safeTransfer(msg.sender, amount);
        ps.stakeToken.burn(address(this), withdraw.stake);
        delete ps.stakesWithdraw[msg.sender][_id];
    }

    function getWithdrawal(address _staker, uint256 _id)
        external
        view
        returns (PoolStorage.StakeWithdraw memory)
    {
        (, PoolStorage.Base storage ps) = baseData();
        return ps.stakesWithdraw[_staker][_id];
    }

    function getWithdrawalSize(address _staker)
        external
        view
        returns (uint256)
    {
        (, PoolStorage.Base storage ps) = baseData();
        return ps.stakesWithdraw[_staker].length;
    }

    function getWithrawalInitialIndex(address _staker)
        external
        view
        returns (uint256)
    {
        (, PoolStorage.Base storage ps) = baseData();
        for (uint256 i = 0; i < ps.stakesWithdraw[_staker].length; i++) {
            if (ps.stakesWithdraw[_staker][i].blockInitiated > 0) {
                return i;
            }
        }
        return ps.stakesWithdraw[_staker].length;
    }

    function baseData()
        internal
        view
        returns (IERC20 token, PoolStorage.Base storage ps)
    {
        token = bps();
        ps = PoolStorage.ps(address(token));
        require(ps.initialized, "INVALID_TOKEN");
    }

    function bps() internal pure returns (IERC20 rt) {
        // These fields are not accessible from assembly
        bytes memory array = msg.data;
        uint256 index = msg.data.length;

        // solhint-disable-next-line no-inline-assembly
        assembly {
            // Load the 32 bytes word from memory with the address on the lower 20 bytes, and mask those.
            rt := and(
                mload(add(array, index)),
                0xffffffffffffffffffffffffffffffffffffffff
            )
        }
    }
}
