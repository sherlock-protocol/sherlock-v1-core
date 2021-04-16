//SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IStake.sol";
import "./interfaces/ISolution.sol";

contract Stake is ERC20, IStake, Ownable {
    address public override underyling;

    constructor(
        string memory name_,
        string memory symbol_,
        address _underyling
    ) public ERC20(name_, symbol_) {
        underyling = _underyling;
    }

    function mint(address _account, uint256 _amount)
        external
        override
        onlyOwner
    {
        _mint(_account, _amount);
    }

    function burn(address _account, uint256 _amount)
        external
        override
        onlyOwner
    {
        _burn(_account, _amount);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        ISolution(owner())._beforeTokenTransfer(from, to, amount);
    }

    function getOwner() external override view returns (address) {
        return owner();
    }
}
