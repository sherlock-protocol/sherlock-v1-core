// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPayout {
    function getGovPayout() external view returns (address);

    function setInitialGovPayout(address _govPayout) external;

    function transferGovPayout(address _govPayout) external;

    function payout(
        address _payout,
        IERC20[] memory _tokens,
        uint256[] memory _firstMoneyOut,
        uint256[] memory _amounts,
        uint256[] memory _unmaterializedSherX
    ) external;
}
