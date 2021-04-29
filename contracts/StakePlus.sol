//SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IStake.sol";
import "./interfaces/IStakePlus.sol";
import "./interfaces/ISolution.sol";

import "./Stake.sol";

contract StakePlus is Stake, IStakePlus {
    address public override underlying;

    constructor(
        string memory name_,
        string memory symbol_,
        address _underlying
    ) public Stake(name_, symbol_) {
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
