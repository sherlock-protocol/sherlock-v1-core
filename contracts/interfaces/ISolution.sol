// SPDX-License-Identifier: Apache-2.0
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "diamond-2/contracts/interfaces/IERC173.sol";
import "diamond-2/contracts/interfaces/IDiamondLoupe.sol";
import "diamond-2/contracts/interfaces/IDiamondCut.sol";
import "./IERC20Facet.sol";
import "./IGov.sol";
import "./IManager.sol";
import "./IPool.sol";
import "./IFee.sol";

pragma solidity ^0.7.4;
pragma abicoder v2;

interface ISolution is
    IERC173,
    IDiamondLoupe,
    IDiamondCut,
    IERC20Facet,
    IERC20,
    IGov,
    IManager,
    IPool,
    IFee
{}
