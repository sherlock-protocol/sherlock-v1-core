//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.4;

import "hardhat/console.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";

import "../interfaces/IManager.sol";

import "../storage/LibPool.sol";
import "../storage/LibGov.sol";

contract Manager is IManager {
    using SafeMath for uint256;

    function setProtocolPremiums(
        bytes32 _protocol,
        address[] memory _tokens,
        uint256[] memory _premiums
    ) external override {
        GovStorage.Base storage gs = GovStorage.gs();
        require(gs.protocolsCovered[_protocol], "NOT_COVERED");
        require(_tokens.length == _premiums.length, "LENGTH");

        for (uint256 i = 0; i < _tokens.length; i++) {
            PoolStorage.Base storage ps = PoolStorage.ps(_tokens[i]);
            require(ps.initialized, "WHITELIST");
            uint256 premium = _premiums[i];

            // pay off debt for old premium variable
            // TODO IPool(tokenPool).tryPayOffDebtAll();
            ps.totalPremiumPerBlock = ps
                .totalPremiumPerBlock
                .sub(ps.protocolPremium[_protocol])
                .add(premium);
            ps.protocolPremium[_protocol] = premium;
        }
    }
}
