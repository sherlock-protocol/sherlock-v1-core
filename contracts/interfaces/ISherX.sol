// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../interfaces/ILock.sol';

/**
  @title SHERX Logic Controller
  @author Evert Kors
  @notice This contract is used to manage functions related to the SHERX token
  @dev Contract is meant to be included as a facet in the diamond
*/
interface ISherX {
  //
  // Events
  //

  /**
    @notice Sends an event whenever a staker "harvests" earned SHERX
    @notice Harvesting is when SHERX "interest" is staked in the SHERX pool
    @param user Address of the user for whom SHERX will be harvested
    @param token Token which has accumulated the SHERX that should be harvested
  */
  event Harvest(address indexed user, IERC20 indexed token);

  //
  // View methods
  //

  /**
    @notice Returns the USD amount of tokens being added to the SHERX pool each block
    @return USD amount added to SHERX pool per block
  */
  function getTotalUsdPerBlock() external view returns (uint256);

  /**
    @notice Returns the total USD amount of tokens represented by SHERX (underlying SHERX) since last update
    @return Last stored value of total USD underlying SHERX
  */
  function getTotalUsdPoolStored() external view returns (uint256);

  /**
    @notice Returns the calculated total USD amount of tokens represented by SHERX at that block
    @return Current total USD underlying SHERX
  */
  function getTotalUsdPool() external view returns (uint256);

  /**
    @notice Returns block number at which the total USD underlying SHERX was last stored
    @return Block number for stored USD underlying SHERX
  */
  function getTotalUsdLastSettled() external view returns (uint256);

  /**
    @notice Returns stored USD amount underlying SHERX in the specified token
    @return Stored USD amount underlying SHERX for _token
  */
  function getStoredUsd(IERC20 _token) external view returns (uint256);

  /**
    @notice Returns SHERX that has not been minted but should/will be based on underlying collateral
    @return Unminted amount of SHERX tokens
  */
  function getTotalSherXUnminted() external view returns (uint256);

  /**
    @notice Returns total amount of SHERX (minted and unminted)
    @return total amount of SHERX tokens
  */
  function getTotalSherX() external view returns (uint256);

  /**
    @notice Returns the amount of SHERX to be minted based on USD premiums at the current block
    @return SHERX created (to be minted later) at the current block
  */
  function getSherXPerBlock() external view returns (uint256);

  /**
    @notice Returns the amount of SHERX accrued by the address of the sender
    @return SHERX accrued to msg.sender
    @question Does this count staked SHERX? Or SHERX accrued to staked SHERX?
  */
  function getSherXBalance() external view returns (uint256);

  /**
    @notice Returns the amount of SHERX accrued by the specified address
    @param _user address to get the SHERX balance of
    @return SHERX accrued to _user
    @question Does this count staked SHERX? Or SHERX accrued to staked SHERX?
  */
  function getSherXBalance(address _user) external view returns (uint256);

  /**
    @notice Returns the total supply of SHERX from storage (only used internally)
    @return Total supply of SHERX
  */
  function getInternalTotalSupply() external view returns (uint256);

  /**
    @notice Returns the block number when total SHERX supply was last set in storage
    @return block number of last write to storage for the total SHERX supply
  */
  function getInternalTotalSupplySettled() external view returns (uint256);

  /**
    @notice Returns the tokens and amounts underlying msg.sender's SHERX balance
    @return Array of ERC-20 tokens and corresponding arrays of amounts of those tokens
  */
  function calcUnderlying()
    external
    view
    returns (IERC20[] memory tokens, uint256[] memory amounts);

  /**
    @notice Returns the tokens and amounts underlying _user's SHERX balance
    @param _user Address whose underlying SHERX tokens should be queried
    @return Array of ERC-20 tokens and corresponding arrays of amounts of those tokens
  */
  function calcUnderlying(address _user)
    external
    view
    returns (IERC20[] memory tokens, uint256[] memory amounts);

  /**
    @notice Returns the tokens and amounts underlying the given amount of SHERX
    @param _amount Amount of SHERX tokens to find the underlying tokens of
    @return Array of ERC-20 tokens and corresponding arrays of amounts of those tokens
  */
  function calcUnderlying(uint256 _amount)
    external
    view
    returns (IERC20[] memory tokens, uint256[] memory amounts);

  /**
    @notice Returns the USD amount underlying msg.sender's SHERX (based on stored USD value)
    @return USD value of SHERX accrued to msg.sender
  */
  function calcUnderlyingInStoredUSD() external view returns (uint256);

  /**
    @notice Returns the USD amount underlying the given amount SHERX (based on stored USD value)
    @param _amount Amount of SHERX tokens to find the underlying USD value of
    @return USD value of the given amount of SHERX
  */
  function calcUnderlyingInStoredUSD(uint256 _amount) external view returns (uint256 usd);

  //
  // State changing methods
  //

  /**
    @notice Calculates the SHERX accrued by the specified lockTokens of the sender (from is the sender)
    @notice When lockTokens are transferred, the accrued SHERX is "harvested" for the sender
    @param from Address from which lockTokens are being transferred
    @param to Address to which lockTokens are being transferred
    @param amount Amount of lockTokens to be transferred
  */
  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) external;

  /**
    @notice Makes sure all staking pool weights are zero then sets entire weight to the Watsons (security team) initially
  */
  function setInitialWeight() external;

  /**
    @notice Decides what % of premium payments (SHERX tokens) goes to each token staking pool and to the Watsons (security team)
    @param _tokens Array of tokens to set the weights of
    @param _weights Respective weighting for each token
    @param _watsons Weighting to set for the Watsons (security team)
  */
  function setWeights(
    IERC20[] memory _tokens,
    uint256[] memory _weights,
    uint256 _watsons
  ) external;

  /**
    @notice Moves msg.sender's accrued SHERX (accrued from staking ETH, DAI, etc.) into the SHERX staking pool where it can earn interest (in the form of more SHERX)
  */
  function harvest() external;

  /**
    @notice Moves msg.sender's accrued SHERX from specified token only into the SHERX staking pool where it can earn interest (in the form of more SHERX)
    @param _token Token to harvest accrued SHERX for
  */
  function harvest(ILock _token) external;

  /**
    @notice Moves msg.sender's accrued SHERX from specified tokens only into the SHERX staking pool where it can earn interest (in the form of more SHERX)
    @param _tokens Array of tokens to harvest accrued SHERX for
  */
  function harvest(ILock[] calldata _tokens) external;

  /**
    @notice Moves accrued SHERX (for specified address) for all tokens into the SHERX staking pool where it can earn interest (in the form of more SHERX)
    @param _user Address for which to harvest all SHERX
  */
  function harvestFor(address _user) external;

  /**
    @notice Moves accrued SHERX (for specified address) for a specified token into the SHERX staking pool where it can earn interest (in the form of more SHERX)
    @param _user Address for which to harvest
    @param _token Token for which to harvest
  */
  function harvestFor(address _user, ILock _token) external;

  /**
    @notice Moves accrued SHERX (for specified address) for specified tokens into the SHERX staking pool where it can earn interest (in the form of more SHERX)
    @param _user Address for which to harvest
    @param _tokens Array of tokens for which to harvest
  */
  function harvestFor(address _user, ILock[] calldata _tokens) external;

  /**
    @notice Redeems SHERX tokens for the underlying collateral (ETH, DAI, etc.)
    @param _amount Amount of SHERX tokens to redeem from msg.sender's SHERX balance
    @param _receiver Address to send redeemed tokens to
  */
  function redeem(uint256 _amount, address _receiver) external;

  /**
    @notice Accrues SHERX to all staking pools and to Watsons based on weightings (and since last accrual)
  */
  function accrueSherX() external;

  /**
    @notice Accrues SHERX to specific token's staking pool (since last accrual)
    @param _token Token representing the staking pool to accrue SHERX to
  */
  function accrueSherX(IERC20 _token) external;

  /**
    @notice Accrues SHERX to the Watsons (security team) based on weighting (and since last accrual)
  */
  function accrueSherXWatsons() external;
}
