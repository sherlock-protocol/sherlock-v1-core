# Sherlock V1

[![CI](https://github.com/sherlock-protocol/sherlock-v1-core/actions/workflows/CI.yml/badge.svg)](https://github.com/sherlock-protocol/sherlock-v1-core/actions/workflows/CI.yml)

Sherlock protocol is built using [EIP-2535: Diamonds](https://eips.ethereum.org/EIPS/eip-2535). Sherlock's `PoolStorage` uses a token address to calculate the pointer to the storage position. This allows Sherlock to easily support more tokens.

Sherlock has three agents interacting with the protocol.

- Stakers
- Protocols
- Governance

Protocols are identified by a bytes32 variable. Calculated by hashing a certain string (e.g. `keccak(sherlock.protocol)`). Governance can set/update the rate of accruing debt of the protocol to Sherlock. Protocols are expected to have an active balance deposited. Governance is able to make a payout to the protocol in the event of a covered exploit at that protocol. Funds staked by the stakers can be used for that payout. Stakers receive "interest" by way of the protocol payments and in the form of `SherX`. `SherX` is a single ERC-20 token that represents all the underlying balances paid by protocols in varying tokens.

## Token Lifetime

A single token can be used by stakers to stake (i.e. provide liquidity to Sherlock) and/or as payment by protocols. A token can also be in an inactive state where it isn't used by any agent.

#### Adding

Tokens are added using the `tokeninit()` function. The function parameters can be used to whitelist the token for stakers and/or protocols. This function can also be used to reinitialize a token (e.g. re-enabling for stakers and/or protocols).

#### Staking

Once added and initialized as a staking token, stakers can provide liquidity using the token. Based on the `sherXWeight`, `sherXPerBlock` and `stakeBalance` the compensation is calculated for the provided stake. Stakers can remove their stake at any time. Using `activateCooldown()`, stakers can start the countdown for unstaking. After the specified number of blocks stored in `unstakeCooldown`, stakers can withdraw their stake and earned interest using `unstake()`.

#### Premiums

Accounts can deposit balance on behalf of a protocol using `depositProtocolBalance()` once a token has been added and initialized as a protocol token, and once the protocol is added to the registry with the token whitelisted as a payment method (using `protocolAdd()`).  Governance can set/update the rate of accruing debt (i.e. the price the protocol pays) using the `Manager.sol` facet. Multiple functions are defined so that premiums can be updated as gas efficiently as possible.

#### Disable/remove

All good things come to an end, as do some tokens.

For the longevity of the protocol it is important that tokens can be removed. This is done in multiple steps:

1. `tokenDisableStakers()` is the first step towards completely removing a token. This function can also be called if governance decides to temporarily halt new deposits by stakers.
2. `tokenUnload()` swaps/removes all the active tokens (of the type to be removed) for another token in the protocol. This way there will be zero balance of the token (to be removed) underlying SHERX.
3. `tokenDisableProtocol()` requires no protocols to be actively accruing debt (i.e. paying in the token to be removed). It cleans up storage and removes the ability for any protocol to accrue debt in this token.
4. `tokenRemove()` Removes the main storage in `GovStorage`.

#### Re-enable

Re-enabling needs a custom crafted re-enabling plan. Although most storage is deleted, the `sWithdrawn` and `sWeight` ─ used for SherX rewards ─ is kept. Potential solutions are creating a custom storage pointer or creating a storage cleanup script.

## Protocol Lifetime

Protocols are identified by a bytes32 variable. Governance adds an account as the `_protocolAgent`, this account is able to withdraw balances on behalf of the protocol.

#### Adding

Protocol are added using the `protocolAdd()` function. An array of tokens is provided that whitelist the protocol to pay in a certain token (or tokens). Eligible tokens need to be added with `tokenInit()` first. The array can be extended using `protocolDepositAdd()` and shortened using `cleanProtocol()`.

#### Premiums

Governance can set/update the rate of accruing debt using the `Manager.sol` facet. The debt can be redeemed at any given block. If the protocols have insufficient balance deposited, the protocol defaults and some functions stop working for the protocol. Although this event is unfortunate, Governance can see it coming and act beforehand.

> :warning: Some functionality will be disabled if a protocol has insufficient balance. This can be mitigated using the `cleanProtocol()` call.

#### Cleaning

Cleaning a protocol from the `poolStorage` (for a single token at a time) is done using `cleanProtocol()`. This remove the possibility for the protocol to accrue debt in the token and cleans up storage.

#### Deleting

Deleting a protocol is done by cleaning the protocol from every token. Finally `protocolRemove()` is called to remove the protocol completely.

## Price Decimals

Internal token prices (added/updated using the function in the `Manager.sol` contract) need to make a sum of 36 with the decimals of the token.

e.g.

```
TokenX = 18 decimals, price precision = 18 decimals
TokenY = 8 decimals, price precision = 28 decimals
TokenZ = 6 decimals, price precision = 30 decimals
```
