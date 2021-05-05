// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import 'hardhat/console.sol';

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import 'diamond-2/contracts/libraries/LibDiamond.sol';

import '../interfaces/IGov.sol';
import '../interfaces/lock/IForeignLock.sol';

import '../storage/LibGov.sol';
import '../storage/LibPool.sol';

contract Gov is IGov {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  //
  // Modifiers
  //

  modifier onlyGovInsurance() {
    require(msg.sender == GovStorage.gs().govInsurance, 'NOT_GOV_INS');
    _;
  }

  //
  // View methods
  //

  function getGovInsurance() external view override returns (address) {
    return GovStorage.gs().govInsurance;
  }

  function getUnstakeWindow() external view override returns (uint256 unstakeWindow) {
    GovStorage.Base storage gs = GovStorage.gs();
    unstakeWindow = gs.unstakeWindow;
  }

  function getCooldown() external view override returns (uint256 period) {
    GovStorage.Base storage gs = GovStorage.gs();
    period = gs.unstakeCooldown;
  }

  function getTokens() external view override returns (IERC20[] memory tokens) {
    tokens = GovStorage.gs().tokens;
  }

  function getProtocolIsCovered(bytes32 _protocol) external view override returns (bool) {
    return GovStorage.gs().protocolIsCovered[_protocol];
  }

  function getProtocolManager(bytes32 _protocol) external view override returns (address manager) {
    manager = GovStorage.gs().protocolManagers[_protocol];
  }

  function getProtocolAgent(bytes32 _protocol) external view override returns (address agent) {
    agent = GovStorage.gs().protocolAgents[_protocol];
  }

  //
  // State changing methods
  //

  function setInitialGovInsurance(address _govInsurance) external override {
    GovStorage.Base storage gs = GovStorage.gs();

    require(_govInsurance != address(0), 'ZERO_GOV');
    require(msg.sender == LibDiamond.contractOwner(), 'NOT_DEV');
    require(gs.govInsurance == address(0), 'ALREADY_SET');

    gs.govInsurance = _govInsurance;
  }

  function transferGovInsurance(address _govInsurance) external override onlyGovInsurance {
    require(_govInsurance != address(0), 'ZERO_GOV');
    require(GovStorage.gs().govInsurance != _govInsurance, 'SAME_GOV');
    GovStorage.gs().govInsurance = _govInsurance;
  }

  function setUnstakeWindow(uint256 _unstakeWindow) external override onlyGovInsurance {
    GovStorage.Base storage gs = GovStorage.gs();
    gs.unstakeWindow = _unstakeWindow;
  }

  function setCooldown(uint256 _period) external override onlyGovInsurance {
    GovStorage.Base storage gs = GovStorage.gs();
    gs.unstakeCooldown = _period;
  }

  function protocolAdd(
    bytes32 _protocol,
    address _eoaProtocolAgent,
    address _eoaManager,
    IERC20[] memory _tokens
  ) external override onlyGovInsurance {
    GovStorage.Base storage gs = GovStorage.gs();
    require(!gs.protocolIsCovered[_protocol], 'COVERED');
    gs.protocolIsCovered[_protocol] = true;

    bool[] memory deposits = new bool[](_tokens.length);
    for (uint256 i; i < deposits.length; i++) {
      deposits[i] = true;
    }
    protocolUpdate(_protocol, _eoaProtocolAgent, _eoaManager);
    protocolDepositUpdate(_protocol, _tokens, deposits);
  }

  function protocolUpdate(
    bytes32 _protocol,
    address _eoaProtocolAgent,
    address _eoaManager
  ) public override onlyGovInsurance {
    require(_protocol != bytes32(0), 'ZERO_PROTOCOL');
    require(_eoaProtocolAgent != address(0), 'ZERO_AGENT');
    require(_eoaManager != address(0), 'ZERO_MANAGER');

    GovStorage.Base storage gs = GovStorage.gs();
    require(gs.protocolIsCovered[_protocol], 'NOT_COVERED');

    gs.protocolManagers[_protocol] = _eoaManager;
    gs.protocolAgents[_protocol] = _eoaProtocolAgent;
  }

  function protocolDepositUpdate(
    bytes32 _protocol,
    IERC20[] memory _tokens,
    bool[] memory _deposits
  ) public override onlyGovInsurance {
    require(_protocol != bytes32(0), 'ZERO_PROTOCOL');
    require(_tokens.length == _deposits.length, 'LENGTH');
    require(_tokens.length > 0, 'ZERO');

    GovStorage.Base storage gs = GovStorage.gs();
    require(gs.protocolIsCovered[_protocol], 'NOT_COVERED');

    for (uint256 i; i < _tokens.length; i++) {
      PoolStorage.Base storage ps = PoolStorage.ps(address(_tokens[i]));
      require(ps.initialized, 'INIT');

      ps.protocolDeposit[_protocol] = _deposits[i];
    }
  }

  function protocolRemove(bytes32 _protocol) external override onlyGovInsurance {
    GovStorage.Base storage gs = GovStorage.gs();
    require(gs.protocolIsCovered[_protocol], 'NOT_COVERED');

    for (uint256 i; i < gs.tokens.length; i++) {
      IERC20 token = gs.tokens[i];

      PoolStorage.Base storage ps = PoolStorage.ps(address(token));
      // if protocol never deposited, storage is kept
      delete ps.protocolDeposit[_protocol];
      // basically need to check if accruedDebt > 0, but this is true in case premium > 0
      require(ps.protocolPremium[_protocol] == 0, 'DEBT');
      require(!ps.isProtocol[_protocol], 'POOL_PROTOCOL');
    }
    delete gs.protocolIsCovered[_protocol];
    delete gs.protocolManagers[_protocol];
    delete gs.protocolAgents[_protocol];
  }

  function tokenAdd(
    IERC20 _token,
    INativeLock _lock,
    address _govPool,
    bool _stakes
  ) external override onlyGovInsurance {
    GovStorage.Base storage gs = GovStorage.gs();
    PoolStorage.Base storage ps = PoolStorage.ps(address(_token));

    require(address(_token) != address(0), 'ZERO_TOKEN');
    require(!ps.initialized, 'INITIALIZED');
    require(address(_lock) != address(0), 'ZERO_LOCK');
    require(_lock.getOwner() == address(this), 'OWNER');
    require(_govPool != address(0), 'ZERO_GOV');
    require(_lock.totalSupply() == 0, 'SUPPLY');
    // If not native (e.g. NOT SherX), verify underlying mapping
    if (address(_token) != address(this)) {
      require(IForeignLock(address(_lock)).underlying() == address(_token), 'UNDERLYING');
    }

    gs.tokens.push(_token);
    ps.initialized = true;
    ps.stakes = _stakes;
    ps.lockToken = _lock;
    ps.govPool = _govPool;
    emit TokenAdded(_token, _lock);
  }

  function tokenDisable(IERC20 _token) external override onlyGovInsurance {
    PoolStorage.Base storage ps = PoolStorage.ps(address(_token));
    require(ps.initialized, 'NOT_INITIALIZED');
    require(ps.sherXWeight == 0, 'ACTIVE_WEIGHT');

    require(ps.stakes, 'ALREADY_DISABLED');
    ps.stakes = false;
  }

  function tokenRemove(
    IERC20 _token,
    uint256 _index,
    address _to
  ) external override onlyGovInsurance {
    require(_to != address(0), 'ZERO_TO');

    GovStorage.Base storage gs = GovStorage.gs();
    require(gs.tokens[_index] == _token, 'INDEX');

    PoolStorage.Base storage ps = PoolStorage.ps(address(_token));
    // Moved from disable to remove, as disable can be skipped
    // in case protocol only pay premium with this token
    require(ps.totalPremiumPerBlock == 0, 'ACTIVE_PREMIUM');
    // Can this line cause a revert?
    require(ps.initialized, 'NOT_INITIALIZED');
    // should all be removed, just as the balances
    require(ps.protocols.length == 0, 'ACTIVE_PROTOCOLS');
    require(!ps.stakes, 'DISABLE_FIRST');

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
    delete ps.govPool;
    delete ps.initialized;
    delete ps.stakes;
    delete ps.stakeBalance;
    //delete ps.protocolBalance;
    //delete ps.protocolPremium;
    delete ps.totalPremiumPerBlock;
    delete ps.totalPremiumLastPaid;
    delete ps.sherXUnderlying;
    //delete ps.sWithdrawn
    delete ps.sWeight;
    delete ps.sherXWeight;
    //delete ps.unstakeEntries;
    delete ps.lockToken;
    //delete ps.isProtocol
    delete ps.protocols;
    delete ps.activateCooldownFee;
    uint256 totalToken = ps.stakeBalance.add(ps.firstMoneyOut);
    if (totalToken > 0) {
      _token.safeTransfer(_to, totalToken);
    }
    uint256 totalFee = ps.unmaterializedSherX.add(ps.sherXUnderlying);
    if (totalToken > 0) {
      IERC20(address(this)).safeTransfer(_to, totalFee);
    }
  }
}
