//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.4;

import "hardhat/console.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";

import "../interfaces/IManager.sol";

import "../libraries/LibFee.sol";
import "../libraries/LibPool.sol";

contract Manager is IManager {
    using SafeMath for uint256;

    // TODO
    // split updating
    // prices, premiums (and make it easy to do both)

    function setProtocolPremiums(
        bytes32 _protocol,
        IERC20[] memory _token,
        uint256[] memory _premium,
        uint256[] memory _price
    ) external override {
        require(_token.length == _premium.length, "LENGTH");
        require(_token.length == _price.length, "LENGTH");
        for (uint256 i; i < _token.length; i++) {
            setProtocolPremium(_protocol, _token[i], _premium[i], _price[i]);
        }
        // todo gas optimize
    }

    function setProtocolPremium(
        bytes32 _protocol,
        IERC20 _token,
        uint256 _premium,
        uint256 _price
    ) public override {
        GovStorage.Base storage gs = GovStorage.gs();
        PoolStorage.Base storage ps = PoolStorage.ps(address(_token));
        FeeStorage.Base storage fs = FeeStorage.fs();
        LibERC20Storage.ERC20Storage storage es = LibERC20Storage
            .erc20Storage();

        require(ps.initialized, "WHITELIST");

        LibPool.payOffDebtAll(IERC20(_token));
        if (fs.feeLastAccrued == 0) {
            fs.feeLastAccrued = block.number;
        }

        require(gs.protocolIsCovered[_protocol], "NOT_COVERED");
        require(gs.protocolManagers[_protocol] == msg.sender, "NOT_MANAGER");

        LibFee.accrueUSDPool();
        LibFee.accrueFeeToken();
        uint256 curUsd = fs.tokenUSD[_token];
        // sub old premium in usd, add new premium in usdd
        // TODO optimize, writing to times to storage
        fs.totalBlockIncrement = fs.totalBlockIncrement.sub(
            ps.protocolPremium[_protocol].mul(curUsd).div(10**18)
        );
        fs.totalBlockIncrement = fs.totalBlockIncrement.add(
            _premium.mul(_price).div(10**18)
        );

        //IF price changes, we need to recalc current USD pool
        // if (fs.tokenUSD[_token] != _price) {
        fs.totalUsdPool = fs
            .totalUsdPool
            .sub(ps.underlyingForFee.mul(curUsd).div(10**18))
            .add(ps.underlyingForFee.mul(_price).div(10**18));
        // recalcs current poolbalance

        // update price
        fs.tokenUSD[_token] = _price;

        // payoffDebt (+ add exra pool balance with new price)

        ps.totalPremiumPerBlock = ps
            .totalPremiumPerBlock
            .sub(ps.protocolPremium[_protocol])
            .add(_premium);
        ps.protocolPremium[_protocol] = _premium;

        if (fs.feePerBlock == 0) {
            fs.feePerBlock = 10**18;
        } else if (fs.totalUsdPool > 0) {
            // TODO validate when fs.totalUsdPool
            fs.feePerBlock = es.totalSupply.mul(fs.totalBlockIncrement).div(
                fs.totalUsdPool
            );
        }
    }
}
