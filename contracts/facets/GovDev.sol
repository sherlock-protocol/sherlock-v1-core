//SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;
pragma abicoder v2;

import "diamond-2/contracts/libraries/LibDiamond.sol";
import "../interfaces/IGovDev.sol";

contract GovDev is IGovDev {
    function getGovDev() external override view returns (address) {
        return LibDiamond.contractOwner();
    }

    function transferGovDev(address _govDev) external override {
        LibDiamond.enforceIsContractOwner();
        LibDiamond.setContractOwner(_govDev);
    }

    function updateSolution(
        IDiamondCut.FacetCut[] memory _diamondCut,
        address _init,
        bytes memory _calldata
    ) external override {
        LibDiamond.enforceIsContractOwner();
        return LibDiamond.diamondCut(_diamondCut, _init, _calldata);
    }
}
