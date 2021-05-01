// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.4;
pragma abicoder v2;

import "diamond-2/contracts/libraries/LibDiamond.sol";

interface IGovDev {
    function transferGovDev(address _govDev) external;

    function getGovDev() external returns (address);

    function updateSolution(
        IDiamondCut.FacetCut[] memory _diamondCut,
        address _init,
        bytes memory _calldata
    ) external;
}
