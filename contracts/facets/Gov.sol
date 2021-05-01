//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.4;

import "hardhat/console.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "diamond-2/contracts/libraries/LibDiamond.sol";

import "../interfaces/IGov.sol";

import "../libraries/LibSherX.sol";
import "../libraries/LibSherXERC20.sol";

import "../storage/LibSherXERC20.sol";

contract Gov is IGov {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    function getGovInsurance() external override view returns (address) {
        return GovStorage.gs().govInsurance;
    }

    function setInitialGovInsurance(address _govInsurance) external override {
        GovStorage.Base storage gs = GovStorage.gs();

        require(_govInsurance != address(0), "ZERO_GOV");
        require(msg.sender == LibDiamond.contractOwner(), "NOT_OWNER");
        require(gs.govInsurance == address(0), "ALREADY_SET");

        gs.govInsurance = _govInsurance;
    }

    modifier onlyGovInsurance() {
        require(msg.sender == GovStorage.gs().govInsurance, "NOT_GOV");
        _;
    }

    function transferGovInsurance(address _govInsurance)
        external
        override
        onlyGovInsurance
    {
        require(_govInsurance != address(0), "ZERO_GOV");
        require(GovStorage.gs().govInsurance != _govInsurance, "SAME_GOV");
        GovStorage.gs().govInsurance = _govInsurance;
    }

    function setUnstakeWindow(uint256 _claimPeriod)
        external
        override
        onlyGovInsurance
    {
        GovStorage.Base storage gs = GovStorage.gs();
        gs.unstakePeriod = _claimPeriod;
    }

    function setCooldown(uint256 _timeLock) external override onlyGovInsurance {
        GovStorage.Base storage gs = GovStorage.gs();
        gs.withdrawTimeLock = _timeLock;
    }

    function getUnstakeWindow()
        external
        override
        view
        returns (uint256 claimPeriod)
    {
        GovStorage.Base storage gs = GovStorage.gs();
        claimPeriod = gs.unstakePeriod;
    }

    function getCooldown() external override view returns (uint256 timeLock) {
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
    ) external override onlyGovInsurance {
        GovStorage.Base storage gs = GovStorage.gs();
        require(!gs.protocolIsCovered[_protocol], "COVERED");
        gs.protocolIsCovered[_protocol] = true;

        protocolUpdate(_protocol, _eoaProtocolAgent, _eoaManager);
    }

    function protocolUpdate(
        bytes32 _protocol,
        address _eoaProtocolAgent,
        address _eoaManager
    ) public override onlyGovInsurance {
        require(_protocol != bytes32(0), "ZERO_PROTOCOL");
        require(_eoaProtocolAgent != address(0), "ZERO_AGENT");
        require(_eoaManager != address(0), "ZERO_MANAGER");

        GovStorage.Base storage gs = GovStorage.gs();
        require(gs.protocolIsCovered[_protocol], "NOT_COVERED");

        gs.protocolManagers[_protocol] = _eoaManager;
        gs.protocolAgents[_protocol] = _eoaProtocolAgent;
    }

    function protocolRemove(bytes32 _protocol)
        external
        override
        onlyGovInsurance
    {
        GovStorage.Base storage gs = GovStorage.gs();
        require(gs.protocolIsCovered[_protocol], "NOT_COVERED");

        for (uint256 i; i < gs.tokens.length; i++) {
            IERC20 token = gs.tokens[i];

            PoolStorage.Base storage ps = PoolStorage.ps(address(token));
            // basically need to check if accruedDebt > 0, but this is true in case premium > 0
            require(ps.protocolPremium[_protocol] == 0, "DEBT");
            require(!ps.isProtocol[_protocol], "NOT_PROTOCOL");
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
        INativeStake _stake,
        address _govPool
    ) external override onlyGovInsurance {
        GovStorage.Base storage gs = GovStorage.gs();
        PoolStorage.Base storage ps = PoolStorage.ps(address(_token));

        require(address(_token) != address(0), "ZERO_TOKEN");
        require(!ps.initialized, "INITIALIZED");
        require(address(_stake) != address(0), "ZERO_STAKE");
        require(_stake.getOwner() == address(this), "OWNER");
        require(_govPool != address(0), "ZERO_GOV");
        require(_stake.totalSupply() == 0, "SUPPLY");

        gs.tokens.push(_token);
        ps.initialized = true;
        ps.stakes = true;
        ps.stakeToken = _stake;
        ps.govPool = _govPool;
        emit TokenAdded(_token, _stake);
    }

    function tokenDisable(IERC20 _token) external override onlyGovInsurance {
        PoolStorage.Base storage ps = PoolStorage.ps(address(_token));
        require(ps.initialized, "NOT_INITIALIZED");
        require(ps.totalPremiumPerBlock == 0, "ACTIVE_PREMIUM");
        require(ps.stakes, "ALREADY_DISABLED");
        ps.stakes = false;
    }

    function tokenRemove(
        IERC20 _token,
        uint256 _index,
        address _to
    ) external override onlyGovInsurance {
        require(_to != address(0), "ZERO_TO");

        GovStorage.Base storage gs = GovStorage.gs();
        require(gs.tokens[_index] == _token, "INDEX");

        PoolStorage.Base storage ps = PoolStorage.ps(address(_token));
        require(ps.initialized, "NOT_INITIALIZED");
        require(ps.protocols.length == 0, "ACTIVE_PROTOCOLS");

        // move last index to index of _token
        gs.tokens[_index] = gs.tokens[gs.tokens.length - 1];
        // remove last index
        gs.tokens.pop();

        // TODO, mapping storage is kept
        // deleting + adding a token with non-default storage can cause unexpected behaviour.
        // todo, dont user storage poiner? Or add nonce to storage pointer
        // or make it possible to overwrite storage? (not prefered)
        // 27/3, I think it is cool, as balance+premium+isProtocol will be reset (as all protocols need to be deleted)
        // stakeWithdraw is kept, only results in withdraws potentially having index > 0
        delete ps.initialized;
        delete ps.stakes;
        delete ps.stakeBalance;
        //delete ps.protocolBalance;
        //delete ps.protocolPremium;
        delete ps.totalPremiumPerBlock;
        delete ps.totalPremiumLastPaid;
        //delete ps.unstakeEntries;
        delete ps.stakeToken;
        //delete ps.isProtocol;
        delete ps.protocols;
        delete ps.govPool;
        if (ps.stakeBalance > 0) {
            _token.safeTransfer(_to, ps.stakeBalance);
        }
    }

    function payout(
        address _payout,
        IERC20[] memory _tokens,
        uint256[] memory _firstMoneyOut,
        uint256[] memory _amounts,
        uint256[] memory _unmaterializedSherX
    ) external override {
        // all pools (including SherX pool) can be deducted fmo and balance
        // deducting balance will reduce the users underlying value of stake token
        // for every pool, _unmaterializedSherX can be deducted, this will decrease outstanding SherX rewards
        // for users that did not claim them (e.g materialized them and included in SherX pool)

        SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();
        SherXStorage.Base storage sx = SherXStorage.sx();

        // todo require all equal lengths

        LibSherX.accrueSherX();
        uint256 totalUnmaterializedFee = 0;

        for (uint256 i; i < _tokens.length; i++) {
            PoolStorage.Base storage ps = PoolStorage.ps(address(_tokens[i]));
            require(
                ps.unmaterializedSherX >= _unmaterializedSherX[i],
                "ERR_UNMAT_FEE"
            );
            ps.sWeight = ps.sWeight.sub(_unmaterializedSherX[i]);
            ps.firstMoneyOut = ps.firstMoneyOut.sub(_firstMoneyOut[i]);
            ps.stakeBalance = ps.stakeBalance.sub(_amounts[i]);

            totalUnmaterializedFee = totalUnmaterializedFee.add(
                _unmaterializedSherX[i]
            );

            uint256 total = _firstMoneyOut[i].add(_amounts[i]);
            if (total > 0) {
                _tokens[i].safeTransfer(_payout, total);
            }
        }
        if (totalUnmaterializedFee > 0) {
            LibSherXERC20.mint(_payout, totalUnmaterializedFee);
        }
    }
}
