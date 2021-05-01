// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.7.4;
pragma abicoder v2;

import "diamond-2/contracts/libraries/LibDiamond.sol";

interface IGovDev {
    function getGovDev() external view returns (address);

    function transferGovDev(address _govDev) external;

    function updateSolution(
        IDiamondCut.FacetCut[] memory _diamondCut,
        address _init,
        bytes memory _calldata
    ) external;
}
