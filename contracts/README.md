# Vexor Terminal — Smart Contracts

Foundry project for the Vexor Terminal on-chain stack.

## Live tokens

### Base mainnet · production

| Contract | Purpose | Base mainnet |
|---|---|---|
| `$VT` (Vexor Terminal) | ERC-20 production token. 100B total supply, 18 decimals. | [`0x2c684D666998436634EcEde1527EdA7975427Ba3`](https://basescan.org/address/0x2c684D666998436634EcEde1527EdA7975427Ba3) |

### Base Sepolia · console demo (this Foundry project)

The Foundry sources in this directory (`VexorToken`, `VexorStaking`, `VexorGovernor`) are the testnet console demo. They run on Base Sepolia so anyone can claim, stake, and vote without spending real gas. They are NOT the mainnet $VT token.

| Contract | Purpose | Base Sepolia |
|---|---|---|
| `VexorToken` | ERC-20Votes + EIP-2612 Permit. 10M supply on testnet. Faucet: 1,000 $VT per address. | [`0x200b75db62fa66f325191b34ef784ade26321570`](https://sepolia.basescan.org/address/0x200b75db62fa66f325191b34ef784ade26321570) |
| `VexorStaking` | 4 lock tiers (30 / 90 / 180 / 365 d → 1× / 1.5× / 2× / 3× multiplier). Rewards stream over 30 days. | [`0x6a345b8390a67681764521d146853211dd089062`](https://sepolia.basescan.org/address/0x6a345b8390a67681764521d146853211dd089062) |
| `VexorGovernor` | OZ Governor v5. 4% quorum, 1-block delay, ~4 h voting period, 100 $VT proposal threshold. | [`0xd1850b4c2e663b45a49330d00637db78197be31c`](https://sepolia.basescan.org/address/0xd1850b4c2e663b45a49330d00637db78197be31c) |

## Setup

```bash
# Install Foundry: https://book.getfoundry.sh/getting-started/installation
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install dependencies (forge-std, openzeppelin-contracts)
forge install foundry-rs/forge-std --no-commit
forge install OpenZeppelin/openzeppelin-contracts --no-commit
```

## Build & Test

```bash
forge build
forge test -vv
```

All 9 unit tests pass on a clean checkout.

## Deploy

Set `DEPLOYER_PRIVATE_KEY` in your environment (never commit). Then:

```bash
forge script script/Deploy.s.sol \
  --rpc-url base_sepolia \
  --broadcast \
  --private-key $DEPLOYER_PRIVATE_KEY
```

## Verify on Basescan

```bash
export BASESCAN_API_KEY=...      # from https://basescan.org/myapikey
forge verify-contract \
  --chain base-sepolia \
  --etherscan-api-key $BASESCAN_API_KEY \
  <address> src/VexorToken.sol:VexorToken
```

## Notes

- These Foundry contracts target Base Sepolia for the interactive console
  demo. The production $VT token (Base mainnet, `0x2c68…7Ba3`) is a separate
  deployment and is not built from this Foundry project.
- The deployer wallet is the temporary `owner` of `VexorToken` and `VexorStaking`. Transfer
  ownership to a multisig before any mainnet migration of staking/governance.
- `VexorToken.claim()` is a public 1-per-address faucet kept for testnet UX. **Remove it
  before any mainnet deployment** (or replace with a Merkle-airdrop).
- Reward funding (`fundRewards`) and notification (`notifyRewardAmount`) are owner-only.
