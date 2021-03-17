//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.4;

import "hardhat/console.sol";

import "../interfaces/IGov.sol";

contract Gov is IGov {
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

    function protocolAdd(
        bytes32 _protocol,
        address _eoaProtocolAgent,
        address _eoaManager
    ) external override {
        GovStorage.Base storage gs = GovStorage.gs();
        require(!gs.protocolsCovered[_protocol], "COVERED");
        gs.protocolsCovered[_protocol] = true;

        protocolUpdate(_protocol, _eoaProtocolAgent, _eoaManager);
    }

    function protocolUpdate(
        bytes32 _protocol,
        address _eoaProtocolAgent,
        address _eoaManager
    ) public {
        require(_protocol != bytes32(0), "ZERO");
        require(_eoaProtocolAgent != address(0), "ZERO");
        require(_eoaManager != address(0), "ZERO");

        GovStorage.Base storage gs = GovStorage.gs();
        gs.protocolManagers[_protocol] = _eoaManager;
        gs.protocolAgents[_protocol] = _eoaProtocolAgent;
    }

    function tokenAdd(IERC20 _token, IStake _stake) external override {
        PoolStorage.Base storage ps = PoolStorage.ps(address(_token));

        require(address(_token) != address(0), "ZERO");
        require(!ps.initialized, "INITIALIZED");
        require(address(_stake) != address(0), "ZERO");
        require(_stake.getOwner() == address(this), "OWNER");

        ps.initialized = true;
        ps.stakeToken = _stake;

        emit TokenAdded(_token, _stake);
    }
}
