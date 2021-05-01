// SPDX-License-Identifier: Apache-2.0
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "diamond-2/contracts/interfaces/IERC173.sol";
import "diamond-2/contracts/interfaces/IDiamondLoupe.sol";
import "diamond-2/contracts/interfaces/IDiamondCut.sol";
import "./ISherX.sol";
import "./ISherXERC20.sol";
import "./IGov.sol";
import "./IManager.sol";
import "./IPool.sol";

pragma solidity ^0.7.4;
pragma abicoder v2;

interface ISolution is
    IERC173,
    IDiamondLoupe,
    IDiamondCut,
    ISherX,
    ISherXERC20,
    IERC20,
    IGov,
    IManager,
    IPool
{}
