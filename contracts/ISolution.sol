// SPDX-License-Identifier: Apache-2.0
import "diamond-2/contracts/interfaces/IERC173.sol";
import "diamond-2/contracts/interfaces/IDiamondLoupe.sol";
import "diamond-2/contracts/interfaces/IDiamondCut.sol";
import "./interfaces/IGov.sol";
import "./interfaces/IManager.sol";
import "./interfaces/IPool.sol";

pragma solidity ^0.7.4;
pragma experimental ABIEncoderV2;

interface ISolution is
    IERC173,
    IDiamondLoupe,
    IDiamondCut,
    IGov,
    IManager,
    IPool
{}
