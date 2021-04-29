//SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;

import "hardhat/console.sol";

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IStake.sol";
import "../interfaces/IStakeToken.sol";
import "../interfaces/ISolution.sol";

contract SherlockSwap {
    using SafeERC20 for IERC20;
    using SafeERC20 for IStakeToken;
    IUniswapV2Router02 router = IUniswapV2Router02(
        0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
    );

    function testSetRouter(address _router) external {
        // TODO remove
        router = IUniswapV2Router02(_router);
    }

    struct withdrawal {
        address user;
        IStakeToken token;
        uint256 tokenID;
        uint256 feeID;
    }

    withdrawal[] withdrawals;
    ISolution public sherlock;
    IERC20 public stakeFee;

    constructor(ISolution _sherlock, IERC20 _stakeFee) public {
        sherlock = _sherlock;
        stakeFee = _stakeFee;
    }

    function withdrawStake(uint256 _amount, IStakeToken _token)
        external
        returns (uint256 index)
    {
        // TODO bool for max stakewithdraw, and check before balance of stakeFEE
        // withdraws your stake
        // withdraws all stake fee
        // user should approve stakeToken to sherlock contract

        // withdraw fee stake
        // withdraw stake fee
        _token.safeTransferFrom(msg.sender, address(this), _amount);
        _token.approve(address(sherlock), _amount);

        uint256 id = sherlock.withdrawStake(_amount, _token.underlying());

        uint256 stakeFeeAmount = stakeFee.balanceOf(msg.sender);
        uint256 feeID = uint256(-1);
        if (stakeFeeAmount > 0) {
            stakeFee.safeTransferFrom(
                msg.sender,
                address(this),
                stakeFeeAmount
            );
            stakeFee.approve(address(sherlock), stakeFeeAmount);
            feeID = sherlock.withdrawStake(stakeFeeAmount, address(sherlock));
        }

        index = withdrawals.length;
        withdrawals.push(withdrawal(msg.sender, _token, id, feeID));
    }

    function withdrawClaimSwap(
        uint256 _id,
        uint256 _uniMinOut,
        address[] calldata _uniPath,
        uint256 _uniDeadline
    ) external {
        withdrawal storage w = withdrawals[_id];
        require(w.user == msg.sender, "ERR_SENDER");

        sherlock.withdrawClaim(w.tokenID, msg.sender, w.token.underlying());

        uint256 feeAmount = 0;
        if (w.feeID != uint256(-1)) {
            feeAmount = sherlock.withdrawClaim(
                w.feeID,
                address(this),
                address(sherlock)
            );
        }
        if (feeAmount > 0) {
            IERC20(address(sherlock)).approve(address(router), feeAmount);
            router.swapExactTokensForTokens(
                feeAmount,
                _uniMinOut,
                _uniPath,
                msg.sender,
                _uniDeadline
            );
        }
        delete withdrawals[_id];
    }
}
