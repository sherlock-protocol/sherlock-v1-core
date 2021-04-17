//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.4;
pragma abicoder v2;

import "hardhat/console.sol";

import "../storage/LibPool.sol";
import "../storage/LibGov.sol";

interface IFee {
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) external;

    function harvest(address _token) external;

    function harvestFor(address _token, address _user) external;

    function harvestForMultipleMulti(
        address[] memory _token,
        address[] memory _users,
        address[] memory _debtTokens
    ) external;

    function harvestForMultiple(address _token, address[] memory _users)
        external;

    function setWeights(address[] memory _tokens, uint256[] memory _weights)
        external;

    function calcUnderyling()
        external
        view
        returns (IERC20[] memory tokens, uint256[] memory amounts);

    function calcUnderylingInStoredUSD() external view returns (uint256 usd);

    function calcUnderylingInStoredUSDFor(address _user)
        external
        view
        returns (uint256 usd);
}
