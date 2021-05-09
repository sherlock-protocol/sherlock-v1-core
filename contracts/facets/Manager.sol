// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;
pragma abicoder v2;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import 'hardhat/console.sol';

import '@openzeppelin/contracts/math/SafeMath.sol';

import '../interfaces/IManager.sol';

import '../libraries/LibSherX.sol';
import '../libraries/LibPool.sol';

contract Manager is IManager {
  using SafeMath for uint256;

  // Once transaction has been mined, protocol is officialy insured.

  //
  // Modifiers
  //

  modifier onlyGovInsurance() {
    require(msg.sender == GovStorage.gs().govInsurance, 'NOT_GOV_INS');
    _;
  }

  function onlyValidToken(PoolStorage.Base storage ps, IERC20 _token) private {
    require(address(_token) != address(this), 'SELF');
    require(ps.initialized, 'WHITELIST');
  }

  function setTokenPrice(IERC20 _token, uint256 _newUsd) external override onlyGovInsurance {
    (uint256 usdPerBlock, uint256 usdPool) = _getData();
    (usdPerBlock, usdPool) = _setTokenPrice(_token, _newUsd, usdPerBlock, usdPool);
    _setData(usdPerBlock, usdPool);
  }

  function setTokenPrice(IERC20[] memory _token, uint256[] memory _newUsd)
    external
    override
    onlyGovInsurance
  {
    (uint256 usdPerBlock, uint256 usdPool) = _getData();
    require(_token.length == _newUsd.length, 'LENGTH');
    for (uint256 i; i < _token.length; i++) {
      (usdPerBlock, usdPool) = _setTokenPrice(_token[i], _newUsd[i], usdPerBlock, usdPool);
    }
    _setData(usdPerBlock, usdPool);
  }

  function setProtocolPremium(
    bytes32 _protocol,
    IERC20 _token,
    uint256 _premium
  ) external override onlyGovInsurance {
    (uint256 usdPerBlock, uint256 usdPool) = _getData();
    (usdPerBlock, usdPool) = _setProtocolPremium(_protocol, _token, _premium, usdPerBlock, usdPool);
    _setData(usdPerBlock, usdPool);
  }

  function setProtocolPremium(
    bytes32 _protocol,
    IERC20[] memory _token,
    uint256[] memory _premium
  ) external override onlyGovInsurance {
    (uint256 usdPerBlock, uint256 usdPool) = _getData();
    require(_token.length == _premium.length, 'LENGTH');
    for (uint256 i; i < _token.length; i++) {
      (usdPerBlock, usdPool) = _setProtocolPremium(
        _protocol,
        _token[i],
        _premium[i],
        usdPerBlock,
        usdPool
      );
    }
    _setData(usdPerBlock, usdPool);
  }

  function setProtocolPremium(
    bytes32[] memory _protocol,
    IERC20[][] memory _token,
    uint256[][] memory _premium
  ) external override onlyGovInsurance {
    (uint256 usdPerBlock, uint256 usdPool) = _getData();
    require(_protocol.length == _token.length, 'LENGTH');
    require(_protocol.length == _premium.length, 'LENGTH');

    for (uint256 i; i < _protocol.length; i++) {
      require(_token[i].length == _premium[i].length, 'LENGTH');
      for (uint256 j; j < _protocol.length; j++) {
        (usdPerBlock, usdPool) = _setProtocolPremium(
          _protocol[i],
          _token[i][j],
          _premium[i][j],
          usdPerBlock,
          usdPool
        );
      }
    }
    _setData(usdPerBlock, usdPool);
  }

  function setProtocolPremiumAndTokenPrice(
    bytes32 _protocol,
    IERC20 _token,
    uint256 _premium,
    uint256 _newUsd
  ) external override onlyGovInsurance {
    (uint256 usdPerBlock, uint256 usdPool) = _getData();

    (usdPerBlock, usdPool) = _setProtocolPremiumAndTokenPrice(
      _protocol,
      _token,
      _premium,
      _newUsd,
      usdPerBlock,
      usdPool
    );
    _setData(usdPerBlock, usdPool);
  }

  function setProtocolPremiumAndTokenPrice(
    bytes32 _protocol,
    IERC20[] memory _token,
    uint256[] memory _premium,
    uint256[] memory _newUsd
  ) external override onlyGovInsurance {
    require(_token.length == _premium.length, 'LENGTH_1');
    require(_token.length == _newUsd.length, 'LENGTH_2');

    (uint256 usdPerBlock, uint256 usdPool) = _getData();

    for (uint256 i; i < _token.length; i++) {
      (usdPerBlock, usdPool) = _setProtocolPremiumAndTokenPrice(
        _protocol,
        _token[i],
        _premium[i],
        _newUsd[i],
        usdPerBlock,
        usdPool
      );
    }
    _setData(usdPerBlock, usdPool);
  }

  function setProtocolPremiumAndTokenPrice(
    bytes32[] memory _protocol,
    IERC20[][] memory _token,
    uint256[][] memory _premium,
    uint256[][] memory _newUsd
  ) external override onlyGovInsurance {
    // TODO could be setting _newUsd multiple times
    (uint256 usdPerBlock, uint256 usdPool) = _getData();
    require(_protocol.length == _token.length, 'LENGTH');
    require(_protocol.length == _premium.length, 'LENGTH');
    require(_protocol.length == _newUsd.length, 'LENGTH');

    for (uint256 i; i < _protocol.length; i++) {
      require(_token[i].length == _premium[i].length, 'LENGTH');
      require(_token[i].length == _newUsd[i].length, 'LENGTH');
      for (uint256 j; j < _protocol.length; j++) {
        (usdPerBlock, usdPool) = _setProtocolPremiumAndTokenPrice(
          _protocol[i],
          _token[i][j],
          _premium[i][j],
          _newUsd[i][j],
          usdPerBlock,
          usdPool
        );
      }
    }
    _setData(usdPerBlock, usdPool);
  }

  function _setTokenPrice(
    IERC20 _token,
    uint256 _newUsd,
    uint256 usdPerBlock,
    uint256 usdPool
  ) private returns (uint256, uint256) {
    PoolStorage.Base storage ps = PoolStorage.ps(address(_token));
    onlyValidToken(ps, _token);

    uint256 oldUsd = _setTokenPrice(_token, _newUsd);
    uint256 premium = ps.totalPremiumPerBlock;
    (usdPerBlock, usdPool) = _updateData(
      ps,
      usdPerBlock,
      usdPool,
      premium,
      premium,
      oldUsd,
      _newUsd
    );
    return (usdPerBlock, usdPool);
  }

  function _setTokenPrice(IERC20 _token, uint256 _newUsd) private returns (uint256 oldUsd) {
    SherXStorage.Base storage sx = SherXStorage.sx();

    oldUsd = sx.tokenUSD[_token];
    // used for setProtocolPremiumAndTokenPrice, if same token prices are updated
    if (oldUsd != _newUsd) {
      sx.tokenUSD[_token] = _newUsd;
    }
  }

  function _setProtocolPremium(
    bytes32 _protocol,
    IERC20 _token,
    uint256 _premium,
    uint256 usdPerBlock,
    uint256 usdPool
  ) private returns (uint256, uint256) {
    SherXStorage.Base storage sx = SherXStorage.sx();
    PoolStorage.Base storage ps = PoolStorage.ps(address(_token));
    onlyValidToken(ps, _token);

    (uint256 oldPremium, uint256 newPremium) = _setProtocolPremium(ps, _protocol, _token, _premium);

    uint256 usd = sx.tokenUSD[_token];
    (usdPerBlock, usdPool) = _updateData(
      ps,
      usdPerBlock,
      usdPool,
      oldPremium,
      newPremium,
      usd,
      usd
    );
    return (usdPerBlock, usdPool);
  }

  function _setProtocolPremium(
    PoolStorage.Base storage ps,
    bytes32 _protocol,
    IERC20 _token,
    uint256 _premium
  ) private returns (uint256 oldPremium, uint256 newPremium) {
    LibPool.payOffDebtAll(_token);

    oldPremium = ps.totalPremiumPerBlock;
    newPremium = oldPremium.sub(ps.protocolPremium[_protocol]).add(_premium);

    ps.totalPremiumPerBlock = newPremium;
    ps.protocolPremium[_protocol] = _premium;
  }

  function _setProtocolPremiumAndTokenPrice(
    bytes32 _protocol,
    IERC20 _token,
    uint256 _premium,
    uint256 _newUsd,
    uint256 usdPerBlock,
    uint256 usdPool
  ) private returns (uint256, uint256) {
    PoolStorage.Base storage ps = PoolStorage.ps(address(_token));
    onlyValidToken(ps, _token);

    uint256 oldUsd = _setTokenPrice(_token, _newUsd);
    (uint256 oldPremium, uint256 newPremium) = _setProtocolPremium(ps, _protocol, _token, _premium);
    (usdPerBlock, usdPool) = _updateData(
      ps,
      usdPerBlock,
      usdPool,
      oldPremium,
      newPremium,
      oldUsd,
      _newUsd
    );
    return (usdPerBlock, usdPool);
  }

  function _getData() private view returns (uint256 usdPerBlock, uint256 usdPool) {
    SherXStorage.Base storage sx = SherXStorage.sx();
    usdPerBlock = sx.totalUsdPerBlock;
    usdPool = LibSherX.viewAccrueUSDPool();
  }

  function _updateData(
    PoolStorage.Base storage ps,
    uint256 usdPerBlock,
    uint256 usdPool,
    uint256 _oldPremium,
    uint256 _newPremium,
    uint256 _oldUsd,
    uint256 _newUsd
  ) private view returns (uint256, uint256) {
    uint256 sub = _oldPremium.mul(_oldUsd);
    uint256 add = _newPremium.mul(_newUsd);
    if (sub > add) {
      usdPerBlock = usdPerBlock.sub(sub.sub(add).div(10**18));
    } else {
      usdPerBlock = usdPerBlock.add(add.sub(sub).div(10**18));
    }

    // Dont change usdPool is prices are equal
    if (_newUsd > _oldUsd) {
      usdPool = usdPool.add(_newUsd.sub(_oldUsd).mul(ps.sherXUnderlying).div(10**18));
    } else if (_newUsd < _oldUsd) {
      usdPool = usdPool.sub(_oldUsd.sub(_newUsd).mul(ps.sherXUnderlying).div(10**18));
    }

    return (usdPerBlock, usdPool);
  }

  function _setData(uint256 usdPerBlock, uint256 usdPool) private {
    SherXStorage.Base storage sx = SherXStorage.sx();
    SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();

    LibSherX.accrueSherX();

    if (usdPerBlock > 0 && sx20.totalSupply == 0) {
      // initial accrue
      sx.sherXPerBlock = 10**18;
    } else if (usdPool > 0) {
      sx.sherXPerBlock = sx20.totalSupply.mul(usdPerBlock).div(usdPool);
    } else {
      sx.sherXPerBlock = 0;
    }
    sx.totalUsdPerBlock = usdPerBlock;
    sx.totalUsdPool = usdPool;
    sx.totalUsdLastSettled = block.number;
  }
}
