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

import "./LibPool.sol";

contract Pool {
    // TODO, ability to activate assets (in different facet)

    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using SafeERC20 for IStake;

    function getGovPool(address _token) external view returns (address) {
        (, PoolStorage.Base storage ps) = baseData();
        return ps.govPool;
    }

    function isInitialized(address _token) external view returns (bool) {
        (, PoolStorage.Base storage ps) = baseData();
        return ps.initialized;
    }

    function isDeposit(address _token) external view returns (bool) {
        (, PoolStorage.Base storage ps) = baseData();
        return ps.deposits;
    }

    function getProtocolBalance(bytes32 _protocol, address _token)
        external
        view
        returns (uint256)
    {
        (, PoolStorage.Base storage ps) = baseData();
        return ps.protocolBalance[_protocol];
    }

    function getProtocolPremium(bytes32 _protocol, address _token)
        external
        view
        returns (uint256)
    {
        (, PoolStorage.Base storage ps) = baseData();
        return ps.protocolPremium[_protocol];
    }

    function getStakeToken(address _token) external view returns (address) {
        (, PoolStorage.Base storage ps) = baseData();
        return address(ps.stakeToken);
    }

    function isProtocol(bytes32 _protocol, address _token)
        external
        view
        returns (bool)
    {
        (, PoolStorage.Base storage ps) = baseData();
        return ps.isProtocol[_protocol];
    }

    function getProtocols(address _token)
        external
        view
        returns (bytes32[] memory)
    {
        (, PoolStorage.Base storage ps) = baseData();
        return ps.protocols;
    }

    function depositProtocolBalance(bytes32 _protocol, uint256 _amount)
        external
    {
        require(_amount > 0, "AMOUNT");
        require(GovStorage.gs().protocolIsCovered[_protocol], "PROTOCOL");
        (IERC20 token, PoolStorage.Base storage ps) = baseData();
        require(ps.deposits, "NO_DEPOSITS");

        token.safeTransferFrom(msg.sender, address(this), _amount);
        ps.protocolBalance[_protocol] = ps.protocolBalance[_protocol].add(
            _amount
        );

        if (!ps.isProtocol[_protocol]) {
            // initial deposit
            ps.isProtocol[_protocol] = true;
            ps.protocols.push(_protocol);
        }
    }

    function removeProtocol(
        bytes32 _protocol,
        uint256 _index,
        bool _forceDebt,
        address _receiver
    ) external {
        require(msg.sender == GovStorage.gs().govInsurance, "NOT_GOV");

        (IERC20 _token, PoolStorage.Base storage ps) = baseData();
        require(ps.protocols[_index] == _protocol, "INDEX");

        uint256 accrued = LibPool.accruedDebt(_protocol, _token);
        if (accrued == 0) {
            require(ps.protocolPremium[_protocol] == 0, "CAN_NOT_DELETE");
        } else {
            require(accrued > ps.protocolBalance[_protocol], "CAN_NOT_DELETE2");
        }

        if (_forceDebt && accrued > 0) {
            ps.poolBalance = ps.poolBalance.add(ps.protocolBalance[_protocol]);
            delete ps.protocolBalance[_protocol];
        }

        if (ps.protocolBalance[_protocol] > 0) {
            require(_receiver != address(0), "ADDRESS");
            _token.safeTransfer(_receiver, ps.protocolBalance[_protocol]);
        }

        // move last index to index of _protocol
        ps.protocols[_index] = ps.protocols[ps.protocols.length - 1];
        // remove last index
        delete ps.protocols[ps.protocols.length - 1];
        ps.isProtocol[_protocol] = false;
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
        (IERC20 _token, PoolStorage.Base storage ps) = baseData();

        LibPool.payOffDebtAll(_token);

        if (_amount == uint256(-1)) {
            _amount = ps.protocolBalance[_protocol];
        }

        _token.safeTransfer(_receiver, _amount);
        ps.protocolBalance[_protocol] = ps.protocolBalance[_protocol].sub(
            _amount
        );
    }

    function exchangeRate() external view returns (uint256 rate) {
        // token to stakedtoken
        (, PoolStorage.Base storage ps) = baseData();
        uint256 totalStake = ps.stakeToken.totalSupply();
        require(totalStake > 0, "N0_STAKE");
        require(ps.poolBalance > 0, "NO_FUNDS");
        rate = totalStake.mul(10**18).div(ps.poolBalance);
    }

    function getTotalAccruedDebt() external view returns (uint256) {
        (IERC20 _token, ) = baseData();
        return LibPool.getTotalAccruedDebt(_token);
    }

    function getAccruedDebt(bytes32 _protocol) external view returns (uint256) {
        (IERC20 _token, ) = baseData();
        return LibPool.accruedDebt(_protocol, _token);
    }

    function payOffDebtAll() external {
        (IERC20 _token, ) = baseData();
        LibPool.payOffDebtAll(_token);
    }

    function getTotalPremiumPerBlock() external view returns (uint256) {
        (, PoolStorage.Base storage ps) = baseData();
        return ps.totalPremiumPerBlock;
    }

    function getFirstMoneyOut() external view returns (uint256) {
        (, PoolStorage.Base storage ps) = baseData();
        return ps.firstMoneyOut;
    }

    function getStakersTVL() public view returns (uint256) {
        (IERC20 _token, PoolStorage.Base storage ps) = baseData();
        return ps.poolBalance.add(LibPool.getTotalAccruedDebt(_token));
    }

    function getStakerTVL(address _staker) external view returns (uint256) {
        (, PoolStorage.Base storage ps) = baseData();
        if (ps.stakeToken.totalSupply() == 0) {
            return 0;
        }
        return
            ps.stakeToken.balanceOf(_staker).mul(getStakersTVL()).div(
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
        require(ps.deposits, "NO_DEPOSITS");

        uint256 totalStake = ps.stakeToken.totalSupply();
        if (totalStake == 0) {
            // mint initial stake
            stake = 10**18;
        } else {
            // mint stake based on funds in pool
            stake = _amount.mul(totalStake).div(ps.poolBalance);
        }

        token.safeTransferFrom(msg.sender, address(this), _amount);
        ps.poolBalance = ps.poolBalance.add(_amount);
        ps.stakeToken.mint(_receiver, stake);
    }

    function withdrawStake(uint256 _amount) external returns (uint256) {
        require(_amount > 0, "AMOUNT");
        (IERC20 token, PoolStorage.Base storage ps) = baseData();
        ps.stakeToken.safeTransferFrom(msg.sender, address(this), _amount);

        GovStorage.Base storage gs = GovStorage.gs();
        uint256 stakeTokenExitFee = _amount.mul(gs.exitFee).div(10**18);
        if (stakeTokenExitFee > 0) {
            // stake of user gets burned
            // representative amount token get added to first money out pool
            uint256 tokenAmount = stakeTokenExitFee.mul(getStakersTVL()).div(
                ps.stakeToken.totalSupply()
            );
            ps.poolBalance = ps.poolBalance.sub(tokenAmount);
            ps.firstMoneyOut = ps.firstMoneyOut.add(tokenAmount);

            ps.stakeToken.burn(address(this), stakeTokenExitFee);
        }

        ps.stakesWithdraw[msg.sender].push(
            PoolStorage.StakeWithdraw(
                block.number,
                _amount.sub(stakeTokenExitFee)
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
        require(withdraw.blockInitiated != 0, "WITHDRAW_NOT_ACTIVE");

        require(
            withdraw.blockInitiated.add(gs.withdrawTimeLock) >= block.number,
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
        require(withdraw.blockInitiated != 0, "WITHDRAW_NOT_ACTIVE");

        require(
            withdraw.blockInitiated.add(gs.withdrawTimeLock).add(
                gs.withdrawClaimPeriod
            ) < block.number,
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
            withdraw.blockInitiated.add(gs.withdrawTimeLock) < block.number,
            "TIMELOCK_ACTIVE"
        );
        // claim period is including
        require(
            withdraw.blockInitiated.add(gs.withdrawTimeLock).add(
                gs.withdrawClaimPeriod
            ) > block.number,
            "CLAIMPERIOD_EXPIRED"
        );
        uint256 amount = withdraw.stake.mul(getStakersTVL()).div(
            ps.stakeToken.totalSupply()
        );
        ps.poolBalance = ps.poolBalance.sub(amount);
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

    function getPremiumLastPaid() external view returns (uint256) {
        (, PoolStorage.Base storage ps) = baseData();
        return ps.totalPremiumLastPaid;
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
        GovStorage.Base storage gs = GovStorage.gs();
        for (uint256 i = 0; i < ps.stakesWithdraw[_staker].length; i++) {
            if (ps.stakesWithdraw[_staker][i].blockInitiated == 0) {
                continue;
            }
            if (
                ps.stakesWithdraw[_staker][i]
                    .blockInitiated
                    .add(gs.withdrawTimeLock)
                    .add(gs.withdrawClaimPeriod) <= block.number
            ) {
                continue;
            }
            return i;
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
