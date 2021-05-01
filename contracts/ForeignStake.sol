//SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/stake/IForeignStake.sol";
import "./interfaces/stake/INativeStake.sol";
import "./interfaces/ISolution.sol";

import "./NativeStake.sol";

contract ForeignStake is NativeStake, IForeignStake {
    address public override underlying;

    constructor(
        string memory name_,
        string memory symbol_,
        address _underlying
    ) public NativeStake(name_, symbol_) {
        underlying = _underlying;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        ISolution(owner())._beforeTokenTransfer(from, to, amount);
    }
}
