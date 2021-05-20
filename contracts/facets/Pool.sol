// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;
pragma abicoder v2;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import 'hardhat/console.sol';

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import '../interfaces/ILock.sol';
import '../interfaces/IPool.sol';

import '../libraries/LibPool.sol';

contract Pool is IPool {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;
  using SafeERC20 for ILock;

  //
  // View methods
  //

  function getCooldownFee(IERC20 _token) external view override returns (uint256) {
    (, PoolStorage.Base storage ps) = baseData();
    return ps.activateCooldownFee;
  }

  function getSherXWeight(IERC20 _token) external view override returns (uint256) {
    (, PoolStorage.Base storage ps) = baseData();
    return ps.sherXWeight;
  }

  function getGovPool(IERC20 _token) external view override returns (address) {
    (, PoolStorage.Base storage ps) = baseData();
    return ps.govPool;
  }

  function isPremium(IERC20 _token) external view override returns (bool) {
    (, PoolStorage.Base storage ps) = baseData();
    return ps.premiums;
  }

  function isStake(IERC20 _token) external view override returns (bool) {
    (, PoolStorage.Base storage ps) = baseData();
    return ps.stakes;
  }

  function getProtocolBalance(bytes32 _protocol, IERC20 _token)
    external
    view
    override
    returns (uint256)
  {
    (, PoolStorage.Base storage ps) = baseData();
    return ps.protocolBalance[_protocol];
  }

  function getProtocolPremium(bytes32 _protocol, IERC20 _token)
    external
    view
    override
    returns (uint256)
  {
    (, PoolStorage.Base storage ps) = baseData();
    return ps.protocolPremium[_protocol];
  }

  function getLockToken(IERC20 _token) external view override returns (address) {
    (, PoolStorage.Base storage ps) = baseData();
    return address(ps.lockToken);
  }

  function isProtocol(bytes32 _protocol, IERC20 _token) external view override returns (bool) {
    (, PoolStorage.Base storage ps) = baseData();
    return ps.isProtocol[_protocol];
  }

  function getProtocols(IERC20 _token) external view override returns (bytes32[] memory) {
    (, PoolStorage.Base storage ps) = baseData();
    return ps.protocols;
  }

  function getUnstakeEntry(
    address _staker,
    uint256 _id,
    IERC20 _token
  ) external view override returns (PoolStorage.UnstakeEntry memory) {
    (, PoolStorage.Base storage ps) = baseData();
    return ps.unstakeEntries[_staker][_id];
  }

  function getTotalAccruedDebt(IERC20 _token) external view override returns (uint256) {
    (IERC20 _token, ) = baseData();
    return LibPool.getTotalAccruedDebt(_token);
  }

  function getFirstMoneyOut(IERC20 _token) external view override returns (uint256) {
    (, PoolStorage.Base storage ps) = baseData();
    return ps.firstMoneyOut;
  }

  function getAccruedDebt(bytes32 _protocol, IERC20 _token)
    external
    view
    override
    returns (uint256)
  {
    (IERC20 _token, ) = baseData();
    return LibPool.accruedDebt(_protocol, _token);
  }

  function getTotalPremiumPerBlock(IERC20 _token) external view override returns (uint256) {
    (, PoolStorage.Base storage ps) = baseData();
    return ps.totalPremiumPerBlock;
  }

  function getPremiumLastPaid(IERC20 _token) external view override returns (uint256) {
    (, PoolStorage.Base storage ps) = baseData();
    return ps.totalPremiumLastPaid;
  }

  function getSherXUnderlying(IERC20 _token) external view override returns (uint256) {
    (, PoolStorage.Base storage ps) = baseData();
    return ps.sherXUnderlying;
  }

  function getUnstakeEntrySize(address _staker, IERC20 _token)
    external
    view
    override
    returns (uint256)
  {
    (, PoolStorage.Base storage ps) = baseData();
    return ps.unstakeEntries[_staker].length;
  }

  function getInitialUnstakeEntry(address _staker, IERC20 _token)
    external
    view
    override
    returns (uint256)
  {
    (, PoolStorage.Base storage ps) = baseData();
    GovStorage.Base storage gs = GovStorage.gs();
    for (uint256 i = 0; i < ps.unstakeEntries[_staker].length; i++) {
      if (ps.unstakeEntries[_staker][i].blockInitiated == 0) {
        continue;
      }
      if (
        ps.unstakeEntries[_staker][i].blockInitiated.add(gs.unstakeCooldown).add(
          gs.unstakeWindow
        ) <= block.number
      ) {
        continue;
      }
      return i;
    }
    return ps.unstakeEntries[_staker].length;
  }

  function getStakersPoolBalance(IERC20 _token) public view override returns (uint256) {
    (, PoolStorage.Base storage ps) = baseData();
    return ps.stakeBalance;
  }

  function getStakerPoolBalance(address _staker, IERC20 _token)
    external
    view
    override
    returns (uint256)
  {
    (, PoolStorage.Base storage ps) = baseData();
    if (ps.lockToken.totalSupply() == 0) {
      return 0;
    }
    return
      ps.lockToken.balanceOf(_staker).mul(getStakersPoolBalance(_token)).div(
        ps.lockToken.totalSupply()
      );
  }

  function getTotalUnmintedSherX(IERC20 _token) public view override returns (uint256 sherX) {
    return LibPool.getTotalUnmintedSherX(_token);
  }

  function getUnallocatedSherXStored(IERC20 _token) public view override returns (uint256) {
    (, PoolStorage.Base storage ps) = baseData();
    return ps.unallocatedSherX;
  }

  function getUnallocatedSherXTotal(IERC20 _token) external view override returns (uint256) {
    return getUnallocatedSherXStored(_token).add(LibPool.getTotalUnmintedSherX(_token));
  }

  function getUnallocatedSherXFor(address _user, IERC20 _token)
    external
    view
    override
    returns (uint256)
  {
    return LibPool.getUnallocatedSherXFor(_user, _token);
  }

  function getTotalSherXPerBlock(IERC20 _token) public view override returns (uint256 amount) {
    PoolStorage.Base storage ps = PoolStorage.ps(_token);
    SherXStorage.Base storage sx = SherXStorage.sx();

    amount = sx.sherXPerBlock.mul(ps.sherXWeight).div(10**18);
  }

  function getSherXPerBlock(IERC20 _token) external view override returns (uint256) {
    return getSherXPerBlock(msg.sender, _token);
  }

  function getSherXPerBlock(address _user, IERC20 _token)
    public
    view
    override
    returns (uint256 amount)
  {
    PoolStorage.Base storage ps = PoolStorage.ps(_token);
    if (ps.lockToken.totalSupply() == 0) {
      return 0;
    }
    amount = getTotalSherXPerBlock(_token).mul(ps.lockToken.balanceOf(_user)).div(
      ps.lockToken.totalSupply()
    );
  }

  function getSherXPerBlock(uint256 _lock, IERC20 _token)
    external
    view
    override
    returns (uint256 amount)
  {
    // simulates staking (adding lock)
    (, PoolStorage.Base storage ps) = baseData();
    amount = getTotalSherXPerBlock(_token).mul(_lock).div(ps.lockToken.totalSupply().add(_lock));
  }

  function getSherXLastAccrued(IERC20 _token) external view override returns (uint256) {
    (, PoolStorage.Base storage ps) = baseData();
    return ps.sherXLastAccrued;
  }

  function LockToTokenXRate(IERC20 _token) external view override returns (uint256) {
    return LockToToken(10**18, _token);
  }

  function LockToToken(uint256 _amount, IERC20 _token) public view override returns (uint256) {
    (, PoolStorage.Base storage ps) = baseData();
    uint256 totalLock = ps.lockToken.totalSupply();
    if (totalLock == 0 || ps.stakeBalance == 0) {
      revert('NO_DATA');
    }
    return ps.stakeBalance.mul(_amount).div(totalLock);
  }

  function TokenToLockXRate(IERC20 _token) external view override returns (uint256) {
    return TokenToLock(10**18, _token);
  }

  function TokenToLock(uint256 _amount, IERC20 _token) public view override returns (uint256) {
    (, PoolStorage.Base storage ps) = baseData();
    uint256 totalLock = ps.lockToken.totalSupply();
    if (totalLock == 0 || ps.stakeBalance == 0) {
      return 10**18;
    }
    return totalLock.mul(_amount).div(ps.stakeBalance);
  }

  //
  // Internal view methods
  //

  function baseData() internal view returns (IERC20 token, PoolStorage.Base storage ps) {
    token = bps();
    ps = PoolStorage.ps(token);
    require(ps.govPool != address(0), 'INVALID_TOKEN');
  }

  function bps() internal pure returns (IERC20 rt) {
    // These fields are not accessible from assembly
    bytes memory array = msg.data;
    uint256 index = msg.data.length;

    // solhint-disable-next-line no-inline-assembly
    assembly {
      // Load the 32 bytes word from memory with the address on the lower 20 bytes, and mask those.
      rt := and(mload(add(array, index)), 0xffffffffffffffffffffffffffffffffffffffff)
    }
  }

  //
  // State changing methods
  //

  function setCooldownFee(uint256 _fee, IERC20 _token) external override {
    require(msg.sender == GovStorage.gs().govInsurance, 'NOT_GOV_INS');
    require(_fee <= 10**18, 'MAX_VALUE');

    (, PoolStorage.Base storage ps) = baseData();
    ps.activateCooldownFee = _fee;
  }

  function depositProtocolBalance(
    bytes32 _protocol,
    uint256 _amount,
    IERC20 _token
  ) external override {
    require(_amount > 0, 'AMOUNT');
    require(GovStorage.gs().protocolIsCovered[_protocol], 'PROTOCOL');
    (IERC20 token, PoolStorage.Base storage ps) = baseData();
    require(ps.isProtocol[_protocol], 'NO_DEPOSIT');

    token.safeTransferFrom(msg.sender, address(this), _amount);
    ps.protocolBalance[_protocol] = ps.protocolBalance[_protocol].add(_amount);
  }

  function withdrawProtocolBalance(
    bytes32 _protocol,
    uint256 _amount,
    address _receiver,
    IERC20 _token
  ) external override {
    require(msg.sender == GovStorage.gs().protocolAgents[_protocol], 'SENDER');
    require(_amount > 0, 'AMOUNT');
    require(_receiver != address(0), 'RECEIVER');
    (IERC20 _token, PoolStorage.Base storage ps) = baseData();

    LibPool.payOffDebtAll(_token);

    if (_amount == uint256(-1)) {
      _amount = ps.protocolBalance[_protocol];
    }

    _token.safeTransfer(_receiver, _amount);
    ps.protocolBalance[_protocol] = ps.protocolBalance[_protocol].sub(_amount);
  }

  // TODO initially make stake admin only for the initial fee exchange rate
  // Upgrade contracts later by removing admin only (just a require(msg.sender="a"))
  // We can do it gas efficient by moving the stake() function to a seperate facet
  function stake(
    uint256 _amount,
    address _receiver,
    IERC20 _token
  ) external override returns (uint256 lock) {
    require(_amount > 0, 'AMOUNT');
    require(_receiver != address(0), 'RECEIVER');
    (IERC20 token, PoolStorage.Base storage ps) = baseData();
    require(ps.stakes, 'NO_STAKES');
    token.safeTransferFrom(msg.sender, address(this), _amount);

    lock = LibPool.stake(ps, _amount, _receiver);
  }

  function activateCooldown(uint256 _amount, IERC20 _token) external override returns (uint256) {
    require(_amount > 0, 'AMOUNT');
    (, PoolStorage.Base storage ps) = baseData();

    ps.lockToken.safeTransferFrom(msg.sender, address(this), _amount);
    uint256 fee = _amount.mul(ps.activateCooldownFee).div(10**18);
    if (fee > 0) {
      // stake of user gets burned
      // representative amount token get added to first money out pool
      uint256 tokenAmount = fee.mul(ps.stakeBalance).div(ps.lockToken.totalSupply());
      ps.stakeBalance = ps.stakeBalance.sub(tokenAmount);
      ps.firstMoneyOut = ps.firstMoneyOut.add(tokenAmount);

      ps.lockToken.burn(address(this), fee);
    }

    ps.unstakeEntries[msg.sender].push(PoolStorage.UnstakeEntry(block.number, _amount.sub(fee)));

    return ps.unstakeEntries[msg.sender].length - 1;
  }

  function cancelCooldown(uint256 _id, IERC20 _token) external override {
    (, PoolStorage.Base storage ps) = baseData();
    GovStorage.Base storage gs = GovStorage.gs();

    PoolStorage.UnstakeEntry memory withdraw = ps.unstakeEntries[msg.sender][_id];
    require(withdraw.blockInitiated != 0, 'WITHDRAW_NOT_ACTIVE');

    require(withdraw.blockInitiated.add(gs.unstakeCooldown) >= block.number, 'COOLDOWN_EXPIRED');
    ps.lockToken.safeTransfer(msg.sender, withdraw.lock);
    delete ps.unstakeEntries[msg.sender][_id];
  }

  function unstakeWindowExpiry(
    address _account,
    uint256 _id,
    IERC20 _token
  ) external override {
    (, PoolStorage.Base storage ps) = baseData();
    GovStorage.Base storage gs = GovStorage.gs();

    PoolStorage.UnstakeEntry memory withdraw = ps.unstakeEntries[_account][_id];
    require(withdraw.blockInitiated != 0, 'WITHDRAW_NOT_ACTIVE');

    require(
      withdraw.blockInitiated.add(gs.unstakeCooldown).add(gs.unstakeWindow) < block.number,
      'UNSTAKE_WINDOW_NOT_EXPIRED'
    );
    ps.lockToken.safeTransfer(_account, withdraw.lock);
    delete ps.unstakeEntries[_account][_id];
  }

  function unstake(
    uint256 _id,
    address _receiver,
    IERC20 _token
  ) external override returns (uint256 amount) {
    (IERC20 token, PoolStorage.Base storage ps) = baseData();
    require(_receiver != address(0), 'RECEIVER');
    GovStorage.Base storage gs = GovStorage.gs();
    PoolStorage.UnstakeEntry memory withdraw = ps.unstakeEntries[msg.sender][_id];
    require(withdraw.blockInitiated != 0, 'WITHDRAW_NOT_ACTIVE');
    // period is including
    require(withdraw.blockInitiated.add(gs.unstakeCooldown) < block.number, 'COOLDOWN_ACTIVE');
    require(
      withdraw.blockInitiated.add(gs.unstakeCooldown).add(gs.unstakeWindow) >= block.number,
      'UNSTAKE_WINDOW_EXPIRED'
    );
    amount = withdraw.lock.mul(ps.stakeBalance).div(ps.lockToken.totalSupply());

    ps.stakeBalance = ps.stakeBalance.sub(amount);
    ps.lockToken.burn(address(this), withdraw.lock);
    delete ps.unstakeEntries[msg.sender][_id];
    token.safeTransfer(_receiver, amount);
  }

  function payOffDebtAll(IERC20 _token) external override {
    (IERC20 _token, ) = baseData();
    LibPool.payOffDebtAll(_token);
  }

  function cleanProtocol(
    bytes32 _protocol,
    uint256 _index,
    bool _forceDebt,
    address _receiver,
    IERC20 _token
  ) external override {
    require(msg.sender == GovStorage.gs().govInsurance, 'NOT_GOV_INS');
    require(_receiver != address(0), 'RECEIVER');

    (IERC20 _token, PoolStorage.Base storage ps) = baseData();
    require(ps.protocols[_index] == _protocol, 'INDEX');

    // If protocol has 0 accrued debt, the premium should also be 0
    // If protocol has >0 accrued debt, needs to be bigger then balance
    // Otherwise just update premium to 0 for the protocol first and then delete
    uint256 accrued = LibPool.accruedDebt(_protocol, _token);
    if (accrued == 0) {
      require(ps.protocolPremium[_protocol] == 0, 'CAN_NOT_DELETE');
    } else {
      require(accrued > ps.protocolBalance[_protocol], 'CAN_NOT_DELETE2');
    }

    // send the remained of the protocol balance to the staker pool
    if (_forceDebt && accrued > 0) {
      ps.stakeBalance = ps.stakeBalance.add(ps.protocolBalance[_protocol]);
      delete ps.protocolBalance[_protocol];
    }

    // send any leftovers back to the protocol receiver
    if (ps.protocolBalance[_protocol] > 0) {
      _token.safeTransfer(_receiver, ps.protocolBalance[_protocol]);
      delete ps.protocolBalance[_protocol];
    }

    // move last index to index of _protocol
    ps.protocols[_index] = ps.protocols[ps.protocols.length - 1];
    // remove last index
    ps.protocols.pop();
    ps.isProtocol[_protocol] = false;
    // could still be >0, if accrued more debt than needed.
    delete ps.protocolPremium[_protocol];
  }
}
