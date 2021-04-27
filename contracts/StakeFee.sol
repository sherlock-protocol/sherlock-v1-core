//SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IStake.sol";
import "./interfaces/ISolution.sol";

contract StakeFee is ERC20, IStake, Ownable {
    constructor(string memory name_, string memory symbol_)
        public
        ERC20(name_, symbol_)
    {}

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

    function getOwner() external override view returns (address) {
        return owner();
    }
}
