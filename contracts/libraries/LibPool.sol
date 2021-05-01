import "hardhat/console.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../storage/LibGov.sol";
import "../storage/LibPool.sol";
import "../storage/LibSherX.sol";

library LibPool {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using SafeERC20 for INativeLock;

    function stake(
        PoolStorage.Base storage ps,
        uint256 _amount,
        address _receiver
    ) external returns (uint256 stake) {
        uint256 totalStake = ps.stakeToken.totalSupply();
        if (totalStake == 0) {
            // mint initial stake
            stake = 10**18;
        } else {
            // mint stake based on funds in pool
            stake = _amount.mul(totalStake).div(ps.stakeBalance);
        }
        ps.stakeBalance = ps.stakeBalance.add(_amount);
        ps.stakeToken.mint(_receiver, stake);
    }

    function payOffDebtAll(IERC20 _token) external {
        PoolStorage.Base storage ps = PoolStorage.ps(address(_token));
        for (uint256 i = 0; i < ps.protocols.length; i++) {
            payOffDebt(ps.protocols[i], _token);
        }

        uint256 totalAccruedDebt = getTotalAccruedDebt(_token);
        // move funds to the sherX etf
        ps.sherXUnderlying = ps.sherXUnderlying.add(totalAccruedDebt);

        SherXStorage.Base storage sx = SherXStorage.sx();
        // changes the sx.totalUsdPool
        // sx.totalUsdPool = sx.totalUsdPool.add(
        //     totalAccruedDebt.mul(sx.tokenUSD[_token]).div(10**18)
        // );

        ps.totalPremiumLastPaid = block.number;
    }

    function payOffDebt(bytes32 _protocol, IERC20 _token) private {
        PoolStorage.Base storage ps = PoolStorage.ps(address(_token));
        // todo optimize by forwarding  block.number.sub(protocolPremiumLastPaid) instead of calculating every loop
        uint256 debt = accruedDebt(_protocol, _token);
        ps.protocolBalance[_protocol] = ps.protocolBalance[_protocol].sub(debt);
    }

    function accruedDebt(bytes32 _protocol, IERC20 _token)
        public
        view
        returns (uint256)
    {
        PoolStorage.Base storage ps = PoolStorage.ps(address(_token));

        return
            block.number.sub(ps.totalPremiumLastPaid).mul(
                ps.protocolPremium[_protocol]
            );
    }

    function getTotalAccruedDebt(IERC20 _token) public view returns (uint256) {
        PoolStorage.Base storage ps = PoolStorage.ps(address(_token));

        return
            block.number.sub(ps.totalPremiumLastPaid).mul(
                ps.totalPremiumPerBlock
            );
    }
}
