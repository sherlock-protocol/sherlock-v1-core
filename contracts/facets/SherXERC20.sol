// SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "diamond-2/contracts/libraries/LibDiamond.sol";

import "../interfaces/ISherXERC20.sol";

import "../libraries/LibSherXERC20.sol";

import "../storage/LibSherXERC20.sol";

contract SherXERC20 is IERC20, ISherXERC20 {
    using SafeMath for uint256;

    function initialize(
        uint256 _initialSupply,
        string memory _name,
        string memory _symbol
    ) external override {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();

        require(
            bytes(sx20.name).length == 0 && bytes(sx20.symbol).length == 0,
            "ALREADY_INITIALIZED"
        );

        require(
            bytes(_name).length != 0 && bytes(_symbol).length != 0,
            "INVALID_PARAMS"
        );

        require(msg.sender == ds.contractOwner, "Must own the contract.");

        LibSherXERC20.mint(msg.sender, _initialSupply);

        sx20.name = _name;
        sx20.symbol = _symbol;
    }

    function name() external override view returns (string memory) {
        return SherXERC20Storage.sx20().name;
    }

    function setName(string calldata _name) external override {
        SherXERC20Storage.sx20().name = _name;
    }

    function symbol() external override view returns (string memory) {
        return SherXERC20Storage.sx20().symbol;
    }

    function setSymbol(string calldata _symbol) external override {
        SherXERC20Storage.sx20().symbol = _symbol;
    }

    function decimals() external override pure returns (uint8) {
        return 18;
    }

    function mint(address _receiver, uint256 _amount) external override {
        LibSherXERC20.mint(_receiver, _amount);
    }

    function burn(address _from, uint256 _amount) external override {
        LibSherXERC20.burn(_from, _amount);
    }

    function approve(address _spender, uint256 _amount)
        external
        override
        returns (bool)
    {
        require(_spender != address(0), "SPENDER_INVALID");
        emit Approval(msg.sender, _spender, _amount);
        return LibSherXERC20.approve(msg.sender, _spender, _amount);
    }

    function increaseApproval(address _spender, uint256 _amount)
        external
        override
        returns (bool)
    {
        require(_spender != address(0), "SPENDER_INVALID");
        SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();
        sx20.allowances[msg.sender][_spender] = sx20.allowances[msg
            .sender][_spender]
            .add(_amount);
        emit Approval(
            msg.sender,
            _spender,
            sx20.allowances[msg.sender][_spender]
        );
        return true;
    }

    function decreaseApproval(address _spender, uint256 _amount)
        external
        override
        returns (bool)
    {
        require(_spender != address(0), "SPENDER_INVALID");
        SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();
        uint256 oldValue = sx20.allowances[msg.sender][_spender];
        if (_amount > oldValue) {
            sx20.allowances[msg.sender][_spender] = 0;
        } else {
            sx20.allowances[msg.sender][_spender] = oldValue.sub(_amount);
        }
        emit Approval(
            msg.sender,
            _spender,
            sx20.allowances[msg.sender][_spender]
        );
        return true;
    }

    function transfer(address _to, uint256 _amount)
        external
        override
        returns (bool)
    {
        _transfer(msg.sender, _to, _amount);
        return true;
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 _amount
    ) external override returns (bool) {
        SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();
        require(_from != address(0), "FROM_INVALID");

        // Update approval if not set to max uint256
        if (sx20.allowances[_from][msg.sender] != uint256(-1)) {
            uint256 newApproval = sx20.allowances[_from][msg.sender].sub(
                _amount
            );
            sx20.allowances[_from][msg.sender] = newApproval;
            emit Approval(_from, msg.sender, newApproval);
        }

        _transfer(_from, _to, _amount);
        return true;
    }

    function allowance(address _owner, address _spender)
        external
        override
        view
        returns (uint256)
    {
        return SherXERC20Storage.sx20().allowances[_owner][_spender];
    }

    function balanceOf(address _of) external override view returns (uint256) {
        return SherXERC20Storage.sx20().balances[_of];
    }

    function totalSupply() external override view returns (uint256) {
        return SherXERC20Storage.sx20().totalSupply;
    }

    function _transfer(
        address _from,
        address _to,
        uint256 _amount
    ) internal {
        SherXERC20Storage.Base storage sx20 = SherXERC20Storage.sx20();

        sx20.balances[_from] = sx20.balances[_from].sub(_amount);
        sx20.balances[_to] = sx20.balances[_to].add(_amount);

        emit Transfer(_from, _to, _amount);
    }
}
