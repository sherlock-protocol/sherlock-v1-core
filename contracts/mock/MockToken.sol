//SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _amount
    ) public ERC20(_name, _symbol) {
        _mint(msg.sender, _amount);
    }
}

contract MockTokens8d is ERC20 {
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _amount
    ) public ERC20(_name, _symbol) {
        _mint(msg.sender, _amount);
    }

    function decimals() public virtual override view returns (uint8) {
        return 8;
    }
}

contract MockTokens6d is ERC20 {
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _amount
    ) public ERC20(_name, _symbol) {
        _mint(msg.sender, _amount);
    }

    function decimals() public virtual override view returns (uint8) {
        return 6;
    }
}
