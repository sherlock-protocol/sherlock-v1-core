import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../storage/LibPool.sol";

library LibPool {
    using SafeMath for uint256;

    function payOffDebtAll(IERC20 _token) external {
        PoolStorage.Base storage ps = PoolStorage.ps(address(_token));
        for (uint256 i = 0; i < ps.protocols.length; i++) {
            payOffDebt(ps.protocols[i], _token);
        }
        // move funds to the staker pool
        ps.poolBalance = ps.poolBalance.add(getTotalAccruedDebt(_token));
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