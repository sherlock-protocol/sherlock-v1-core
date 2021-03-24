//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.4;

import "hardhat/console.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../interfaces/IGov.sol";

// todo pause / unpausable

contract Gov is IGov {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    function setClaimPeriod(uint256 _claimPeriod) external override {
        // TODO only gov
        GovStorage.Base storage gs = GovStorage.gs();
        gs.withdrawClaimPeriod = _claimPeriod;
    }

    function setTimeLock(uint256 _timeLock) external override {
        // TODO only gov
        GovStorage.Base storage gs = GovStorage.gs();
        gs.withdrawTimeLock = _timeLock;
    }

    function getClaimPeriod()
        external
        override
        view
        returns (uint256 claimPeriod)
    {
        // TODO only gov
        GovStorage.Base storage gs = GovStorage.gs();
        claimPeriod = gs.withdrawClaimPeriod;
    }

    function getTimeLock() external override view returns (uint256 timeLock) {
        // TODO only gov
        GovStorage.Base storage gs = GovStorage.gs();
        timeLock = gs.withdrawTimeLock;
    }

    function getProtocolIsCovered(bytes32 _protocol)
        external
        override
        view
        returns (bool)
    {
        return GovStorage.gs().protocolIsCovered[_protocol];
    }

    function getProtocolManager(bytes32 _protocol)
        external
        override
        view
        returns (address manager)
    {
        manager = GovStorage.gs().protocolManagers[_protocol];
    }

    function getProtocolAgent(bytes32 _protocol)
        external
        override
        view
        returns (address agent)
    {
        agent = GovStorage.gs().protocolAgents[_protocol];
    }

    function protocolAdd(
        bytes32 _protocol,
        address _eoaProtocolAgent,
        address _eoaManager
    ) external override {
        GovStorage.Base storage gs = GovStorage.gs();
        require(!gs.protocolIsCovered[_protocol], "COVERED");
        gs.protocolIsCovered[_protocol] = true;

        protocolUpdate(_protocol, _eoaProtocolAgent, _eoaManager);
    }

    function protocolUpdate(
        bytes32 _protocol,
        address _eoaProtocolAgent,
        address _eoaManager
    ) public override {
        require(_protocol != bytes32(0), "ZERO");
        require(_eoaProtocolAgent != address(0), "ZERO");
        require(_eoaManager != address(0), "ZERO");

        GovStorage.Base storage gs = GovStorage.gs();
        require(gs.protocolIsCovered[_protocol], "NOT_COVERED");

        gs.protocolManagers[_protocol] = _eoaManager;
        gs.protocolAgents[_protocol] = _eoaProtocolAgent;
    }

    function protocolRemove(bytes32 _protocol, address _receiver)
        external
        override
    {
        GovStorage.Base storage gs = GovStorage.gs();
        for (uint256 i; i < gs.tokens.length; i++) {
            IERC20 token = gs.tokens[i];

            PoolStorage.Base storage ps = PoolStorage.ps(address(token));
            // basically need to check if accruedDebt > 0, but this is true in case premium > 0
            require(ps.protocolPremium[_protocol] == 0, "DEBT");
            require(!ps.isProtocol[_protocol], "IS_PROTOCOL");

            if (ps.protocolBalance[_protocol] > 0) {
                token.safeTransfer(_receiver, ps.protocolBalance[_protocol]);
            }
        }
        delete gs.protocolIsCovered[_protocol];
        delete gs.protocolManagers[_protocol];
        delete gs.protocolAgents[_protocol];
    }

    function getTokens()
        external
        override
        view
        returns (IERC20[] memory tokens)
    {
        tokens = GovStorage.gs().tokens;
    }

    function tokenAdd(
        IERC20 _token,
        IStake _stake,
        address _govPool
    ) external override {
        GovStorage.Base storage gs = GovStorage.gs();
        PoolStorage.Base storage ps = PoolStorage.ps(address(_token));

        require(address(_token) != address(0), "ZERO");
        require(!ps.initialized, "INITIALIZED");
        require(address(_stake) != address(0), "ZERO");
        require(_stake.getOwner() == address(this), "OWNER");

        gs.tokens.push(_token);
        ps.initialized = true;
        ps.deposits = true;
        ps.stakeToken = _stake;
        ps.govPool = _govPool;
        emit TokenAdded(_token, _stake);
    }

    function tokenDisable(IERC20 _token) external override {
        PoolStorage.Base storage ps = PoolStorage.ps(address(_token));
        require(ps.initialized, "NOT_INITIALIZED");
        require(ps.totalPremiumPerBlock == 0, "ACTIVE_PREMIUM");
        require(ps.deposits, "ALREADY_DISABLED");
        ps.deposits = false;
    }

    function tokenRemove(
        IERC20 _token,
        uint256 _index,
        address _to
    ) external override {
        GovStorage.Base storage gs = GovStorage.gs();
        require(gs.tokens[_index] == _token, "INDEX");

        PoolStorage.Base storage ps = PoolStorage.ps(address(_token));
        require(ps.initialized, "NOT_INITIALIZED");
        require(ps.protocols.length == 0, "ACTIVE_PROTOCOLS");

        // move last index to index of _token
        gs.tokens[_index] = gs.tokens[gs.tokens.length - 1];
        // remove last index
        delete gs.tokens[gs.tokens.length - 1];

        // TODO, mapping storage is kept
        // deleting + adding a token with non-default storage can cause unexpected behaviour.
        // todo, dont user storage poiner? Or add nonce to storage pointer
        // or make it possible to overwrite storage? (not prefered)
        delete ps.initialized;
        delete ps.deposits;
        delete ps.poolBalance;
        //delete ps.protocolBalance;
        //delete ps.protocolPremium;
        delete ps.totalPremiumPerBlock;
        delete ps.totalPremiumLastPaid;
        //delete ps.stakesWithdraw;
        delete ps.stakeToken;
        //delete ps.isProtocol;
        delete ps.protocols;
        delete ps.govPool;

        _token.safeTransfer(_to, ps.poolBalance);
    }
}
