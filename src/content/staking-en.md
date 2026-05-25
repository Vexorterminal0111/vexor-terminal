# Vexor Terminal RevShare

### Stake $VT. Earn real $VT. No lock, no tier, no cooldown.

> Single-sided staking pool on **Base mainnet**. Rewards distributed pro-rata from protocol revenue — not inflationary emissions, not synthetic tokens. All math runs on-chain and is verifiable on Basescan.

---

## Table of contents

1. [TL;DR](#tldr)
2. [Why RevShare is different](#why-revshare-is-different)
3. [How it works](#how-it-works)
4. [Worked example](#worked-example)
5. [How to stake — 3 options](#how-to-stake--3-options)
6. [Contracts & verification](#contracts--verification)
7. [UI Console features](#ui-console-features)
8. [Why "no lock" matters](#why-no-lock-matters)
9. [Risks & disclaimer](#risks--disclaimer)
10. [Roadmap](#roadmap)
11. [FAQ](#faq)
12. [Resources](#resources)

---

## TL;DR

| | |
|---|---|
| **Network** | Base mainnet (chainId 8453) |
| **Token** | [$VT on Basescan ↗](https://basescan.org/address/0x2c684D666998436634EcEde1527EdA7975427Ba3) — verified ERC-20, 100B supply, 18 decimals |
| **Staking contract** | [VexorRevShare on Basescan ↗](https://basescan.org/address/0xE25f6243f848523c4577639e975B9F3E0fA57186) — verified, not a proxy |
| **Lock period** | None |
| **Reward source** | $VT from protocol revenue (no new emissions) |
| **Reward distribution** | Pro-rata by pool share, auto-updates when owner pushes |
| **Access** | UI at [vexorterminal.com/#revshare](https://vexorterminal.com/#revshare) or Basescan write tab |

**In one sentence**: Deposit $VT → owner pushes rewards from revenue → your claimable balance grows automatically based on your share → claim anytime → withdraw anytime. No lock, no cooldown, no penalty.

---

## Why RevShare is different

Most staking protocols use **new token emissions** as rewards. That's not revenue share — that's inflation rebranded as "yield":

- New tokens get minted continuously → supply grows → price gets diluted
- Stakers see large token numbers, but per-token value drops
- The scheme only sustains itself if new users keep flowing in (Ponzi mechanic)

**$VT RevShare is designed differently**:

- Rewards = $VT **already in circulation**, drawn from Vexor Terminal's operating revenue (chat usage, runtime fees, etc.)
- Owner must transfer their own $VT before pushing rewards — no minting from thin air
- $VT supply does not grow when rewards are distributed
- Real yield in the same $VT you're staking

**Consequences:**

1. Transparent distribution: every reward push emits a `RewardsPushed(amount)` event on Basescan
2. Sustainability depends on protocol revenue, not new-user growth
3. Pool-wide accounting: existing stakers don't get diluted when new users join

---

## How it works

### 1. Owner pushes rewards

Owner runs 2 transactions:

```text
$VT.approve(revShareContract, amount)
revShareContract.pushRewards(amount)
```

When `pushRewards` executes, the contract updates an internal counter:

```solidity
accRewardPerToken += (pushAmount * 1e18) / totalStaked
```

`accRewardPerToken` is a cumulative variable tracking accumulated rewards per 1 $VT staked, across the pool's entire history.

### 2. Auto-update for every staker

Because `accRewardPerToken` updates in the same block as `pushRewards`, **every active staker** automatically gets their share — no delay, no clicks required.

Unclaimed rewards are computed as:

```solidity
pending = (stake * (accRewardPerToken - userRewardPerTokenPaid)) / 1e18
```

The UI at vexorterminal.com/#revshare displays this number in real time.

### 3. Claim anytime

Click **Claim** → 1 transaction → pending $VT transfers to your wallet immediately. Your stake is untouched — it keeps earning rewards from future pushes.

### 4. Withdraw anytime

Click **Withdraw** → enter amount → 1 transaction → $VT returns to your wallet. You can re-stake later with no penalty.

---

## Worked example

The math is straightforward:

```
your_reward = (your_stake / totalStaked) × pushAmount
```

### Pool snapshot at time of writing

| Metric | Value |
|---|---|
| `totalStaked` | 1,908,238 $VT |
| `accRewardPerToken` | 0.1005 (cumulative /1e18) |
| Pool $VT balance | 1,909,343 $VT |

### Scenario

You stake **10,006 $VT** → your share:

```
10,006 / 1,908,238 = 0.524%
```

Owner pushes **10,000 $VT** in rewards:

```
your_reward = 0.524% × 10,000 = 52.4 $VT
```

That 52.4 $VT lands in your claimable balance in the same block as `pushRewards`. It doesn't matter when you claim — immediately or after several pushes accumulate — the math is identical.

---

## How to stake — 3 options

### Option 1: UI Console *(easiest)*

1. Open [vexorterminal.com/#revshare](https://vexorterminal.com/#revshare)
2. Click **Connect Wallet** — pick Rabby / MetaMask / Rainbow / Coinbase / WalletConnect
3. Ensure you're on **Base mainnet** (chainId 8453). On the wrong network, the UI shows a switch button.
4. **Stake** tab → enter amount → click **Approve $VT** → confirm in wallet → wait for mining
5. Click **Stake** → confirm → done
6. Your stake appears in the "Your stake" stat card; rewards auto-track in "Claimable rewards"

### Option 2: Basescan write tab *(manual)*

For power users who'd rather skip the UI:

**Step 1 — Approve on the $VT token contract** ([open on Basescan ↗](https://basescan.org/address/0x2c684D666998436634EcEde1527EdA7975427Ba3#writeContract))

| Field | Value |
|---|---|
| Function | `approve(spender, amount)` |
| `spender` | RevShare contract — copy from [Basescan ↗](https://basescan.org/address/0xE25f6243f848523c4577639e975B9F3E0fA57186) |
| `amount` | Amount in wei (1 $VT = `1000000000000000000`) |

**Step 2 — Stake on the RevShare contract** ([open on Basescan ↗](https://basescan.org/address/0xE25f6243f848523c4577639e975B9F3E0fA57186#writeContract))

| Field | Value |
|---|---|
| Function | `stake(amount)` |
| `amount` | Same as step 1 |

### Option 3: Programmatic *(for devs)*

```typescript
import { writeContract } from 'wagmi/actions';
import { parseEther } from 'viem';

// Copy current addresses from Basescan links in "Contracts & verification" below,
// or fetch programmatically from https://vexorterminal.com/api/pool (returns JSON).
const REVSHARE = '<VexorRevShare address>';
const VT = '<$VT token address>';
const amount = parseEther('1000'); // 1000 $VT

// Step 1: approve
await writeContract({
  abi: erc20Abi,
  address: VT,
  functionName: 'approve',
  args: [REVSHARE, amount],
});

// Step 2: stake (wait for approve to be mined first)
await writeContract({
  abi: revShareAbi,
  address: REVSHARE,
  functionName: 'stake',
  args: [amount],
});
```

ABI is published at [github.com/Vexorterminal0111/vexor-terminal](https://github.com/Vexorterminal0111/vexor-terminal).

---

## Contracts & verification

### Addresses

| Contract | Basescan | Status |
|---|---|---|
| `$VT` (ERC-20) | [View on Basescan ↗](https://basescan.org/address/0x2c684D666998436634EcEde1527EdA7975427Ba3) | ✓ Verified |
| `VexorRevShare` | [View on Basescan ↗](https://basescan.org/address/0xE25f6243f848523c4577639e975B9F3E0fA57186) | ✓ Verified |

Compiled with Solidity 0.8.26. **Not a proxy**, no upgradeability. Open source on [GitHub](https://github.com/Vexorterminal0111/vexor-terminal).

### Security guarantees

**What the owner CAN do:**

- ✅ `pushRewards(amount)` — distribute rewards (must transfer their own $VT first)
- ✅ `transferOwnership(newOwner)` — migrate to multisig (planned)

**What the owner CANNOT do:**

- ❌ Drain user stakes
- ❌ Pause `withdraw`
- ❌ Modify `accRewardPerToken` manually
- ❌ Slash any stake

---

## UI Console features

The UI is live at [vexorterminal.com/#revshare](https://vexorterminal.com/#revshare):

### Pool stats *(real-time)*

| Stat | Description |
|---|---|
| Total staked | All $VT staked pool-wide |
| Pool $VT balance | All $VT in the contract (staked + pending rewards) |
| Acc Reward Per Token | Cumulative counter /1e18 |
| Your share | Your percentage of the pool (auto-recalculates) |

### User stats *(real-time)*

| Stat | Description |
|---|---|
| Wallet $VT | Free $VT balance in your wallet |
| Your stake | $VT currently staked |
| Claimable rewards | Rewards distributed but not yet claimed |

### Mode tabs

| Tab | Action | Tx count |
|---|---|---|
| **Stake** | Approve $VT → Stake | 2 |
| **Withdraw** | Withdraw directly | 1 |
| **Claim** | One-click claim | 1 |
| **Push Rewards** *(owner only)* | Approve $VT → Push | 2 |

### Tx tracking

Each fired transaction shows a "Pending..." state with a Basescan link. After confirmation, stat cards auto-refetch with no page reload.

---

## Why "no lock" matters

Many staking protocols use lock periods (7 days, 14 days, 21 days) for two reasons:

1. Prevent bank runs if price crashes
2. Security buffer for anomaly investigation

**$VT RevShare deliberately has no lock** because:

- Stake isn't redeployed to validators or farms — it sits idle in the contract, no strategy that can de-peg
- Rewards come from real revenue (not new-user money) — no motive to trap stakers
- UX-first: if you suddenly need your $VT (e.g. to trade), you can withdraw immediately and re-stake later

**Trade-off**: you get slightly less yield because there's no lock multiplier. But since rewards = real revenue redistribution, the yield remains meaningful — and the flexibility is far more valuable.

---

## Risks & disclaimer

### Smart contract risk

The contract is open source and verified, but **no formal audit has been performed yet** (as of this article). Stake with caution. Don't stake more than you can afford to lose.

### Owner risk

The owner is currently a single EOA. If the owner key is compromised, the attacker **CANNOT drain user stakes** (the contract has no admin function for that), but CAN push rewards of 0 (doesn't harm stakers, just blocks future rewards). Mitigation: migrate to a Gnosis Safe multisig (planned).

### Market risk

Rewards are paid in $VT. If $VT price falls, the dollar value of rewards falls. This pool stakes to earn more $VT — not a stablecoin yield product.

### Regulatory risk

$VT is a utility token used to pay for runtime in the Vexor Terminal protocol — **not a security**, not an investment, not a promise of return. RevShare is a protocol-revenue distribution mechanism, not a dividend stock.

---

## Roadmap

### Done

- ✅ Deployed `VexorRevShare` to Base mainnet
- ✅ First reward push (1,000 $VT)
- ✅ UI Console live (Stake / Withdraw / Claim)
- ✅ Owner Push Rewards UI

### Planned

- Multisig owner (Gnosis Safe)
- Formal audit
- APR dashboard (annualized yield based on recent push cadence)
- Reward history (list 10 latest `RewardsPushed` events + tx links)
- Auto-compound strategy template

---

## FAQ

**Q: Minimum stake?**
A: None. You can stake 0.000001 $VT or 1,000,000 $VT — the math scales the same way.

**Q: Do rewards auto-compound?**
A: No. Accumulated rewards are not automatically added to your stake. You must claim first, then manually re-stake. Strategy: run a daily/weekly script that calls `claim()` then `stake(pending)`.

**Q: How is this different from Vexor Staking (on testnet)?**
A: `VexorStaking` (on Base Sepolia) uses a **4-tier lock multiplier** for governance weight and tier access. `VexorRevShare` (on Base mainnet, live) is a flat single-sided pool for **revenue share** — no lock, no multiplier. Two different designs.

**Q: Is gas expensive on Base?**
A: No. Stake/withdraw/claim typically cost <$0.001 in gas on Base mainnet (~50-100k gas per tx, ~$0.0001 per 100k gas on Base).

**Q: If the owner pushes a tiny reward, is it worth claiming?**
A: Depends. Claim gas costs ~$0.001 on Base. If your reward is >$0.01, yes. Otherwise, you can let pushes accumulate and claim less frequently so claim gas amortizes.

**Q: If I withdraw all my stake, do I lose claimable rewards?**
A: No. Already-accumulated `pending` rewards remain claimable even after a full withdraw. `claim()` and `withdraw()` are independent functions.

**Q: How often does the owner push rewards?**
A: There's no required cadence — push frequency depends on when the protocol generates revenue. Every push is on-chain as a `RewardsPushed(amount)` event, trackable on Basescan.

**Q: Can `accRewardPerToken` be manipulated?**
A: No. That variable is only mutated inside `stake()`, `withdraw()`, and `pushRewards()`. The math is deterministic and there is no admin override.

---

## Resources

| Resource | URL |
|---|---|
| App | https://vexorterminal.com |
| RevShare Console | https://vexorterminal.com/#revshare |
| Docs | https://vexorterminal.com/docs |
| $VT Basescan | [View ↗](https://basescan.org/address/0x2c684D666998436634EcEde1527EdA7975427Ba3) |
| RevShare Basescan | [View ↗](https://basescan.org/address/0xE25f6243f848523c4577639e975B9F3E0fA57186) |
| $VT chart | [DexScreener ↗](https://dexscreener.com/base/0x2c684D666998436634EcEde1527EdA7975427Ba3) |
| GitHub | https://github.com/Vexorterminal0111/vexor-terminal |
| Twitter | https://x.com/vexorterminal |

---

<sub>Vexor Terminal is an autonomous AI orchestrator with 9 sub-agents. $VT is the protocol's utility token — pay for runtime, stake for revenue share, govern (coming soon). Live on Base mainnet since 2026.</sub>

<sub>© 2026 Vexor Terminal. This article is not financial advice. DYOR.</sub>
