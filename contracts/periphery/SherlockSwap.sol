//SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;

import "hardhat/console.sol";

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/lock/INativeLock.sol";
import "../interfaces/lock/IForeignLock.sol";
import "../interfaces/ISolution.sol";

contract SherlockSwap {
    using SafeERC20 for IERC20;
    using SafeERC20 for INativeLock;
    using SafeERC20 for IForeignLock;
    IUniswapV2Router02 router = IUniswapV2Router02(
        0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
    );

    function testSetRouter(address _router) external {
        // TODO remove
        router = IUniswapV2Router02(_router);
    }

    struct withdrawal {
        address user;
        IForeignLock token;
        uint256 tokenID;
        uint256 SherXID;
    }

    withdrawal[] withdrawals;
    ISolution public sherlock;
    INativeLock public lockSherX;

    constructor(ISolution _sherlock, INativeLock _lockSherX) public {
        sherlock = _sherlock;
        lockSherX = _lockSherX;
    }

    function activateCooldown(uint256 _amount, IForeignLock _token)
        external
        returns (uint256 index)
    {
        // TODO bool for max stakewithdraw, and check before balance of lockSherX
        // withdraws your stake
        // withdraws all stake SherX
        // user should approve stakeToken to sherlock contract

        // withdraw SherX stake
        // withdraw stake SherX
        _token.safeTransferFrom(msg.sender, address(this), _amount);
        _token.approve(address(sherlock), _amount);

        uint256 id = sherlock.activateCooldown(_amount, _token.underlying());

        uint256 stakeFeeAmount = lockSherX.balanceOf(msg.sender);
        uint256 SherXID = uint256(-1);
        if (stakeFeeAmount > 0) {
            lockSherX.safeTransferFrom(
                msg.sender,
                address(this),
                stakeFeeAmount
            );
            lockSherX.approve(address(sherlock), stakeFeeAmount);
            SherXID = sherlock.activateCooldown(
                stakeFeeAmount,
                address(sherlock)
            );
        }

        index = withdrawals.length;
        withdrawals.push(withdrawal(msg.sender, _token, id, SherXID));
    }

    function unstakeSwap(
        uint256 _id,
        uint256 _uniMinOut,
        address[] calldata _uniPath,
        uint256 _uniDeadline
    ) external {
        withdrawal storage w = withdrawals[_id];
        require(w.user == msg.sender, "ERR_SENDER");

        sherlock.unstake(w.tokenID, msg.sender, w.token.underlying());

        uint256 SherXAmount = 0;
        if (w.SherXID != uint256(-1)) {
            SherXAmount = sherlock.unstake(
                w.SherXID,
                address(this),
                address(sherlock)
            );
        }
        if (SherXAmount > 0) {
            IERC20(address(sherlock)).approve(address(router), SherXAmount);
            router.swapExactTokensForTokens(
                SherXAmount,
                _uniMinOut,
                _uniPath,
                msg.sender,
                _uniDeadline
            );
        }
        delete withdrawals[_id];
    }
}
