//SPDX-License-Identifier: Unlicense
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ISherX {
    //
    // Events
    //

    //
    // View methods
    //

    function calcUnderlying()
        external
        view
        returns (IERC20[] memory tokens, uint256[] memory amounts);

    function calcUnderlying(uint256 _amount)
        external
        view
        returns (IERC20[] memory tokens, uint256[] memory amounts);

    function calcUnderlying(address _user)
        external
        view
        returns (IERC20[] memory tokens, uint256[] memory amounts);

    function calcUnderlyingInStoredUSD() external view returns (uint256 usd);

    function calcUnderlyingInStoredUSDFor(uint256 _amount)
        external
        view
        returns (uint256 usd);

    function getTotalUnmaterializedSherX(address _user, address _token)
        external
        view
        returns (uint256 withdrawable_amount);

    //
    // State changing methods
    //

    function redeem(uint256 _amount, address _receiver) external;

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
}
