// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

import "../storage/LibSherXERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

library LibSherXERC20 {
    using SafeMath for uint256;

    // Need to include events locally because `emit Interface.Event(params)` does not work
    event Transfer(address indexed from, address indexed to, uint256 amount);

    function mint(address _to, uint256 _amount) internal {
        require(_to != address(0), "INVALID_TO_ADDRESS");

        SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();

        sx20.balances[_to] = sx20.balances[_to].add(_amount);
        sx20.totalSupply = sx20.totalSupply.add(_amount);
        emit Transfer(address(0), _to, _amount);
    }

    function burn(address _from, uint256 _amount) internal {
        SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();

        sx20.balances[_from] = sx20.balances[_from].sub(_amount);
        sx20.totalSupply = sx20.totalSupply.sub(_amount);
        emit Transfer(_from, address(0), _amount);
    }

    function approve(
        address _from,
        address _to,
        uint256 _amount
    ) internal returns (bool) {
        SherXERC20Storage.sx20().allowances[_from][_to] = _amount;
        return true;
    }
}
