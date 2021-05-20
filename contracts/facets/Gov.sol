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

import '../storage/GovStorage.sol';
import '../storage/PoolStorage.sol';
import '../storage/SherXStorage.sol';

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

  function getWatsons() external view override returns (address) {
    return GovStorage.gs().watsonsAddress;
  }

  function getWatsonsSherXWeight() external view override returns (uint256) {
    return GovStorage.gs().watsonsSherxWeight;
  }

  function getWatsonsSherxLastAccrued() external view override returns (uint256) {
    return GovStorage.gs().watsonsSherxLastAccrued;
  }

  function getWatsonsSherXPerBlock() public view override returns (uint256 amount) {
    GovStorage.Base storage gs = GovStorage.gs();
    SherXStorage.Base storage sx = SherXStorage.sx();

    amount = sx.sherXPerBlock.mul(gs.watsonsSherxWeight).div(10**18);
  }

  function getWatsonsUnmintedSherX() external view override returns (uint256 sherX) {
    GovStorage.Base storage gs = GovStorage.gs();
    SherXStorage.Base storage sx = SherXStorage.sx();

    sherX = block.number.sub(gs.watsonsSherxLastAccrued).mul(getWatsonsSherXPerBlock());
  }

  function getUnstakeWindow() external view override returns (uint256 unstakeWindow) {
    GovStorage.Base storage gs = GovStorage.gs();
    unstakeWindow = gs.unstakeWindow;
  }

  function getCooldown() external view override returns (uint256 period) {
    GovStorage.Base storage gs = GovStorage.gs();
    period = gs.unstakeCooldown;
  }

  function getTokensStaker() external view override returns (IERC20[] memory tokens) {
    tokens = GovStorage.gs().tokensStaker;
  }

  function getTokensProtocol() external view override returns (IERC20[] memory tokens) {
    tokens = GovStorage.gs().tokensProtocol;
  }

  function getProtocolIsCovered(bytes32 _protocol) external view override returns (bool) {
    return GovStorage.gs().protocolIsCovered[_protocol];
  }

  function getProtocolManager(bytes32 _protocol) external view override returns (address manager) {
    // NOTE: UNUSED
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

  function setWatsonsAddress(address _watsons) external override onlyGovInsurance {
    GovStorage.Base storage gs = GovStorage.gs();

    require(_watsons != address(0), 'ZERO_WATS');
    require(gs.watsonsAddress != _watsons, 'SAME_WATS');
    gs.watsonsAddress = _watsons;
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

    protocolUpdate(_protocol, _eoaProtocolAgent, _eoaManager);
    protocolDepositAdd(_protocol, _tokens);
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

    // NOTE: UNUSED
    gs.protocolManagers[_protocol] = _eoaManager;
    gs.protocolAgents[_protocol] = _eoaProtocolAgent;
  }

  function protocolDepositAdd(bytes32 _protocol, IERC20[] memory _tokens)
    public
    override
    onlyGovInsurance
  {
    require(_protocol != bytes32(0), 'ZERO_PROTOCOL');
    require(_tokens.length > 0, 'ZERO');

    GovStorage.Base storage gs = GovStorage.gs();
    require(gs.protocolIsCovered[_protocol], 'NOT_COVERED');

    for (uint256 i; i < _tokens.length; i++) {
      PoolStorage.Base storage ps = PoolStorage.ps(_tokens[i]);
      require(ps.premiums, 'INIT');
      require(!ps.isProtocol[_protocol], 'ALREADY_ADDED');

      ps.isProtocol[_protocol] = true;
      ps.protocols.push(_protocol);
    }
  }

  function protocolRemove(bytes32 _protocol) external override onlyGovInsurance {
    GovStorage.Base storage gs = GovStorage.gs();
    require(gs.protocolIsCovered[_protocol], 'NOT_COVERED');

    for (uint256 i; i < gs.tokensProtocol.length; i++) {
      IERC20 token = gs.tokensProtocol[i];

      PoolStorage.Base storage ps = PoolStorage.ps(token);
      // basically need to check if accruedDebt > 0, but this is true in case premium > 0
      require(ps.protocolPremium[_protocol] == 0, 'DEBT');
      require(!ps.isProtocol[_protocol], 'POOL_PROTOCOL');
    }
    delete gs.protocolIsCovered[_protocol];
    delete gs.protocolManagers[_protocol];
    delete gs.protocolAgents[_protocol];
  }

  function tokenInit(
    IERC20 _token,
    address _govPool,
    ILock _lock,
    bool _protocolPremium
  ) external override onlyGovInsurance {
    GovStorage.Base storage gs = GovStorage.gs();
    PoolStorage.Base storage ps = PoolStorage.ps(_token);
    require(address(_token) != address(0), 'ZERO_TOKEN');

    if (_govPool != address(0)) {
      ps.govPool = _govPool;
    }
    require(ps.govPool != address(0), 'ZERO_GOV');

    if (address(_lock) != address(0)) {
      if (address(ps.lockToken) == address(0)) {
        require(_lock.getOwner() == address(this), 'OWNER');
        require(_lock.totalSupply() == 0, 'SUPPLY');
        // If not native (e.g. NOT SherX), verify underlying mapping
        if (address(_token) != address(this)) {
          require(_lock.underlying() == _token, 'UNDERLYING');
        }
        ps.lockToken = _lock;
      }
      if (address(ps.lockToken) == address(_lock)) {
        require(!ps.stakes, 'STAKES_SET');
        ps.stakes = true;
        gs.tokensStaker.push(_token);
      } else {
        revert('WRONG_LOCK');
      }
    }

    if (_protocolPremium) {
      require(!ps.premiums, 'PREMIUMS_SET');
      ps.premiums = true;
      gs.tokensProtocol.push(_token);
    }
  }

  function tokenDisableStakers(IERC20 _token, uint256 _index) external override onlyGovInsurance {
    GovStorage.Base storage gs = GovStorage.gs();
    PoolStorage.Base storage ps = PoolStorage.ps(_token);
    require(gs.tokensStaker[_index] == _token, 'INDEX');
    require(ps.sherXWeight == 0, 'ACTIVE_WEIGHT');

    delete ps.stakes;
    // lockToken is kept, as stakers should be able to unstake
    // staking can be reenabled by calling tokenInit
    gs.tokensStaker[_index] = gs.tokensStaker[gs.tokensStaker.length - 1];
    gs.tokensStaker.pop();
  }

  function tokenDisableProtocol(IERC20 _token, uint256 _index) external override onlyGovInsurance {
    GovStorage.Base storage gs = GovStorage.gs();
    PoolStorage.Base storage ps = PoolStorage.ps(_token);
    require(gs.tokensProtocol[_index] == _token, 'INDEX');
    require(ps.totalPremiumPerBlock == 0, 'ACTIVE_PREMIUM');
    require(ps.sherXUnderlying == 0, 'ACTIVE_SHERX');

    delete ps.premiums;
    gs.tokensProtocol[_index] = gs.tokensProtocol[gs.tokensProtocol.length - 1];
    gs.tokensProtocol.pop();
  }

  function tokenRemove(IERC20 _token, address _to) external override onlyGovInsurance {
    require(_to != address(0), 'ZERO_TO');

    GovStorage.Base storage gs = GovStorage.gs();

    PoolStorage.Base storage ps = PoolStorage.ps(_token);
    // Moved from disable to remove, as disable can be skipped
    // in case protocol only pay premium with this token
    require(ps.govPool != address(0), 'EMPTY');
    // should all be removed, just as the balances
    require(!ps.stakes, 'STAKES_SET');
    require(!ps.premiums, 'PREMIUMS_SET');
    require(ps.protocols.length == 0, 'ACTIVE_PROTOCOLS');

    // TODO, mapping storage is kept
    // deleting + adding a token with non-default storage can cause unexpected behaviour.
    // todo, dont user storage poiner? Or add nonce to storage pointer
    // or make it possible to overwrite storage? (not prefered)
    // 27/3, I think it is cool, as balance+premium+isProtocol will be reset (as all protocols need to be deleted)
    // stakeWithdraw is kept, only results in withdraws potentially having index > 0
    delete ps.govPool;
    delete ps.stakeBalance;
    //delete ps.protocolBalance;
    //delete ps.protocolPremium;
    delete ps.totalPremiumPerBlock;
    delete ps.totalPremiumLastPaid;
    //delete ps.sWithdrawn
    delete ps.sWeight;
    delete ps.sherXWeight;
    //delete ps.unstakeEntries;
    delete ps.lockToken;
    //delete ps.isProtocol
    delete ps.protocols;
    delete ps.activateCooldownFee;
    // TODO how do we remove token from ETF? (e.g. sherXUnderlying)
    // IDEA create interfaces and add extra token params
    // interface does swap(token). it returns a uint256 value of the new swapped token value (+transfers tokens to sherlock)
    // complexity is handled in swap contract
    uint256 totalToken = ps.stakeBalance.add(ps.firstMoneyOut).add(ps.sherXUnderlying);

    if (totalToken > 0) {
      _token.safeTransfer(_to, totalToken);
    }
    // todo accruelatest fees
    uint256 totalFee = ps.unallocatedSherX;
    if (totalFee > 0) {
      IERC20(address(this)).safeTransfer(_to, totalFee);
    }
    delete ps.sherXUnderlying;
    delete ps.unallocatedSherX;
    delete ps.firstMoneyOut;
    delete ps.stakeBalance;
  }
}
