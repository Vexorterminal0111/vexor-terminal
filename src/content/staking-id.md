# Vexor Terminal RevShare

### Stake $VT. Earn real $VT. No lock, no tier, no cooldown.

> Single-sided staking pool di **Base mainnet**. Reward dibagi pro-rata dari pendapatan protokol — bukan emisi inflasi, bukan token sintetis. Semua kalkulasi on-chain dan bisa di-verify di Basescan.

---

## Daftar isi

1. [TL;DR](#tldr)
2. [Kenapa RevShare beda](#kenapa-revshare-beda)
3. [Cara kerja](#cara-kerja)
4. [Contoh kalkulasi](#contoh-kalkulasi)
5. [Cara stake — 3 pilihan](#cara-stake--3-pilihan)
6. [Kontrak & verification](#kontrak--verification)
7. [Fitur UI Console](#fitur-ui-console)
8. [Kenapa "no lock" matters](#kenapa-no-lock-matters)
9. [Risiko & disclaimer](#risiko--disclaimer)
10. [Roadmap](#roadmap)
11. [FAQ](#faq)
12. [Resources](#resources)

---

## TL;DR

| | |
|---|---|
| **Network** | Base mainnet (chainId 8453) |
| **Token** | [$VT di Basescan ↗](https://basescan.org/address/0x2c684D666998436634EcEde1527EdA7975427Ba3) — verified ERC-20, supply 100B, 18 decimals |
| **Kontrak staking** | [VexorRevShare di Basescan ↗](https://basescan.org/address/0xE25f6243f848523c4577639e975B9F3E0fA57186) — verified, bukan proxy |
| **Lock period** | Tidak ada |
| **Reward source** | $VT dari pendapatan protokol (bukan emisi baru) |
| **Reward distribusi** | Pro-rata per share di pool, auto-update saat owner push |
| **Cara akses** | UI di [vexorterminal.com/#revshare](https://vexorterminal.com/#revshare) atau Basescan write tab |

**Singkat banget**: Lo deposit $VT → owner push reward dari revenue → balance claimable lo naik otomatis sesuai share → claim kapanpun → withdraw kapanpun. Semua tanpa lock, tanpa cooldown, tanpa penalty.

---

## Kenapa RevShare beda

Banyak staking protocol pake **emisi token baru** sebagai reward. Itu bukan revenue share — itu inflasi yang di-rebrand jadi "yield":

- Token baru di-mint terus → supply naik → harga ke-dilute
- Staker dapat angka token yang besar tapi nilai per token turun
- Skema ini sustainable cuma kalau ada user baru yg masuk terus (Ponzi mechanic)

**$VT RevShare di-design beda**:

- Reward = $VT **yang udah ada di sirkulasi**, diambil dari pendapatan operasional Vexor Terminal (chat usage, runtime fees, dll)
- Owner harus transfer $VT-nya sendiri dulu sebelum push reward — gak bisa mint dari thin air
- Supply $VT gak bertambah saat reward di-distribusi
- Yield real dalam $VT yang sama yang lo stake

**Konsekuensinya:**

1. Distribusi transparan: tiap reward push muncul di Basescan sebagai event `RewardsPushed(amount)`
2. Sustainability bergantung pada revenue protokol, bukan growth user baru
3. Pool-wide accounting: gak ada user yang ke-dilute saat user baru join

---

## Cara kerja

### 1. Owner push reward

Owner jalanin 2 transaksi:

```text
$VT.approve(revShareContract, amount)
revShareContract.pushRewards(amount)
```

Saat `pushRewards` di-eksekusi, kontrak update counter internal:

```solidity
accRewardPerToken += (pushAmount * 1e18) / totalStaked
```

`accRewardPerToken` adalah variabel kumulatif yang melacak akumulasi reward per 1 $VT staked sepanjang sejarah pool.

### 2. Auto-update untuk semua staker

Karena `accRewardPerToken` ke-update di blok yang sama dengan `pushRewards`, **setiap staker** yang lagi staking otomatis dapet bagiannya — gak ada delay, gak perlu klik apa-apa.

Reward yang belum di-claim dihitung dengan:

```solidity
pending = (stake * (accRewardPerToken - userRewardPerTokenPaid)) / 1e18
```

UI di vexorterminal.com/#revshare nampilin angka ini real-time.

### 3. Claim kapanpun

Klik **Claim** → 1 transaksi → $VT pending langsung transfer ke wallet lo. Stake lo gak ke-touch — masih earn reward dari push berikutnya.

### 4. Withdraw kapanpun

Klik **Withdraw** → input amount → 1 transaksi → $VT balik ke wallet. Bisa re-stake belakangan tanpa penalty.

---

## Contoh kalkulasi

Math-nya straightforward:

```
your_reward = (your_stake / totalStaked) × pushAmount
```

### Snapshot pool real (saat artikel ini ditulis)

| Metric | Value |
|---|---|
| `totalStaked` | 1,908,238 $VT |
| `accRewardPerToken` | 0.1005 (cumulative /1e18) |
| Pool $VT balance | 1,909,343 $VT |

### Skenario

Lo punya stake **10,006 $VT** → share lo:

```
10,006 / 1,908,238 = 0.524%
```

Owner push **10,000 $VT** reward:

```
your_reward = 0.524% × 10,000 = 52.4 $VT
```

Reward 52.4 $VT itu langsung nambah ke balance claimable lo di blok yang sama dengan `pushRewards`. Gak peduli kapan lo claim — bisa langsung, bisa nungguin akumulasi beberapa push — hasilnya sama.

---

## Cara stake — 3 pilihan

### Opsi 1: UI Console *(paling gampang)*

1. Buka [vexorterminal.com/#revshare](https://vexorterminal.com/#revshare)
2. Klik **Connect Wallet** — pilih Rabby / MetaMask / Rainbow / Coinbase / WalletConnect
3. Pastiin lo di **Base mainnet** (chainId 8453). Kalo salah chain, UI nampilin tombol switch.
4. Tab **Stake** → input amount → klik **Approve $VT** → konfirmasi di wallet → tunggu mining
5. Klik **Stake** → konfirmasi → done
6. Stake lo muncul di stat card "Your stake"; reward auto-track di "Claimable rewards"

### Opsi 2: Basescan Write Tab *(manual)*

Buat power user yang gak mau pake UI:

**Step 1 — Approve di $VT token contract** ([buka di Basescan ↗](https://basescan.org/address/0x2c684D666998436634EcEde1527EdA7975427Ba3#writeContract))

| Field | Value |
|---|---|
| Function | `approve(spender, amount)` |
| `spender` | Kontrak RevShare — copy dari [Basescan ↗](https://basescan.org/address/0xE25f6243f848523c4577639e975B9F3E0fA57186) |
| `amount` | Jumlah dalam wei (1 $VT = `1000000000000000000`) |

**Step 2 — Stake di RevShare contract** ([buka di Basescan ↗](https://basescan.org/address/0xE25f6243f848523c4577639e975B9F3E0fA57186#writeContract))

| Field | Value |
|---|---|
| Function | `stake(amount)` |
| `amount` | Sama dengan step 1 |

### Opsi 3: Programmatic *(untuk dev)*

```typescript
import { writeContract } from 'wagmi/actions';
import { parseEther } from 'viem';

// Copy address terbaru dari Basescan link di "Kontrak & verification" bawah,
// atau ambil otomatis via https://vexorterminal.com/api/pool (return JSON).
const REVSHARE = '<address VexorRevShare>';
const VT = '<address token $VT>';
const amount = parseEther('1000'); // 1000 $VT

// Step 1: approve
await writeContract({
  abi: erc20Abi,
  address: VT,
  functionName: 'approve',
  args: [REVSHARE, amount],
});

// Step 2: stake (tunggu approve mined)
await writeContract({
  abi: revShareAbi,
  address: REVSHARE,
  functionName: 'stake',
  args: [amount],
});
```

ABI tersedia di [github.com/Vexorterminal0111/vexor-terminal](https://github.com/Vexorterminal0111/vexor-terminal).

---

## Kontrak & verification

### Addresses

| Contract | Basescan | Status |
|---|---|---|
| `$VT` (ERC-20) | [View on Basescan ↗](https://basescan.org/address/0x2c684D666998436634EcEde1527EdA7975427Ba3) | ✓ Verified |
| `VexorRevShare` | [View on Basescan ↗](https://basescan.org/address/0xE25f6243f848523c4577639e975B9F3E0fA57186) | ✓ Verified |

Compiled dengan Solidity 0.8.26. **Bukan proxy**, tidak ada upgradeability. Open source di [GitHub](https://github.com/Vexorterminal0111/vexor-terminal).

### Security guarantees

**Yang owner BISA lakuin:**

- ✅ `pushRewards(amount)` — distribusi reward (harus transfer $VT-nya sendiri dulu)
- ✅ `transferOwnership(newOwner)` — migrate ke multisig (rencana)

**Yang owner GAK BISA lakuin:**

- ❌ Drain stake user
- ❌ Pause `withdraw`
- ❌ Modify `accRewardPerToken` secara manual
- ❌ Slash stake user

---

## Fitur UI Console

UI live di [vexorterminal.com/#revshare](https://vexorterminal.com/#revshare):

### Pool stats *(real-time)*

| Stat | Deskripsi |
|---|---|
| Total staked | Total $VT yang lagi di-stake pool-wide |
| Pool $VT balance | Total $VT di kontrak (staked + pending rewards) |
| Acc Reward Per Token | Counter kumulatif /1e18 |
| Your share | Persen lo dari pool (auto-recalculate) |

### User stats *(real-time)*

| Stat | Deskripsi |
|---|---|
| Wallet $VT | Balance $VT free di wallet lo |
| Your stake | $VT yang lagi staked |
| Claimable rewards | Reward yang udah ter-distribusi tapi belum di-claim |

### Mode tabs

| Tab | Aksi | Tx count |
|---|---|---|
| **Stake** | Approve $VT → Stake | 2 |
| **Withdraw** | Withdraw langsung | 1 |
| **Claim** | One-click claim | 1 |
| **Push Rewards** *(owner only)* | Approve $VT → Push | 2 |

### Tx tracking

Setiap transaksi yang di-fire bakal nampilin "Pending..." state dengan link ke Basescan. Setelah confirm, stat cards auto-refetch tanpa page reload.

---

## Kenapa "no lock" matters

Banyak staking pake lock period (7 hari, 14 hari, 21 hari) buat dua alasan:

1. Prevent bank run kalau harga crash
2. Security buffer buat investigasi anomaly

**$VT RevShare sengaja gak punya lock** karena:

- Stake gak di-redeploy ke validator/farm — duduk diem di contract, gak ada strategy yang bisa de-peg
- Reward dari pendapatan real (bukan user new-money) — gak ada motif buat trap stakers
- UX-first: kalau lo butuh $VT mendadak (e.g. buat trade), lo bisa langsung withdraw + re-stake later

**Trade-off**: lo dapat yield sedikit lebih kecil karena gak ada lock multiplier. Tapi karena reward = redistribusi revenue real, yield-nya tetep meaningful — dan flexibility-nya jauh lebih berharga.

---

## Risiko & disclaimer

### Smart contract risk

Kontrak udah open source dan verified, tapi **audit formal belum dilakukan** (per artikel ini ditulis). Stake with caution, jangan stake more than you can afford to lose.

### Owner risk

Owner saat ini single EOA. Kalau owner key compromised, attacker **GAK BISA drain stake** (kontrak gak punya admin function buat itu), tapi BISA push reward 0 (gak ngerugiin staker, cuma block future rewards). Mitigasi: migrate ke Gnosis Safe multisig (planned).

### Market risk

Reward dibayar dalam $VT. Kalau harga $VT turun, nilai dollar reward turun. Pool ini staking buat earning lebih banyak $VT, bukan stablecoin yield.

### Regulatory risk

$VT adalah utility token buat pay runtime di Vexor Terminal protocol — **bukan security**, bukan investment, bukan promise of return. RevShare adalah mekanisme distribusi protocol revenue, bukan dividend stock.

---

## Roadmap

### Done

- ✅ Deploy kontrak `VexorRevShare` ke Base mainnet
- ✅ First reward push (1,000 $VT)
- ✅ UI Console live (Stake / Withdraw / Claim)
- ✅ Owner Push Rewards UI

### Planned

- Multisig owner (Gnosis Safe)
- Audit formal
- APR dashboard (annualized yield based on recent push cadence)
- Reward history (list 10 latest `RewardsPushed` events + tx links)
- Auto-compound strategy template

---

## FAQ

**Q: Berapa minimum stake?**
A: Gak ada minimum. Lo bisa stake 0.000001 $VT atau 1,000,000 $VT — math-nya scaling sama.

**Q: Apakah reward auto-compound?**
A: Tidak. Reward yang ter-akumulasi gak otomatis ditambahin ke stake. Lo harus claim dulu, lalu manual stake. Strategy: kalau lo mau auto-compound, run script harian/mingguan yang `claim()` lalu `stake(pending)`.

**Q: Apa beda dari Vexor Staking (di testnet)?**
A: `VexorStaking` (di Base Sepolia) pake **4-tier lock multiplier** buat governance weight + tier access. `VexorRevShare` (di Base mainnet, live) flat single-sided pool buat **revenue share** — gak ada lock, gak ada multiplier. Dua konsep berbeda.

**Q: Apakah gas mahal di Base?**
A: Tidak. Stake/withdraw/claim biasanya kost gas <$0.001 di Base mainnet (~50-100k gas per tx, ~$0.0001 per 100k gas di Base).

**Q: Kalau owner push reward kecil, worth claim?**
A: Tergantung. Gas claim ~$0.001 di Base. Kalau reward lo >$0.01, worth. Atau lo akumulasi beberapa push sebelum claim biar gas effective per push lebih kecil.

**Q: Kalau gua withdraw all, apakah claimable reward hilang?**
A: Tidak. Reward yang udah ter-akumulasi (`pending`) tetep claimable bahkan setelah lo withdraw semua stake. `claim()` dan `withdraw()` adalah fungsi independen.

**Q: Berapa kali owner push reward?**
A: Tidak ada cadence wajib — push frequency tergantung kapan protokol generate revenue. Setiap push muncul on-chain sebagai event `RewardsPushed(amount)`, bisa di-track di Basescan.

**Q: Apakah `accRewardPerToken` bisa di-manipulate?**
A: Tidak. Variable itu cuma di-update di `stake()`, `withdraw()`, dan `pushRewards()`. Math-nya deterministic dan gak ada admin override.

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

<sub>Vexor Terminal adalah autonomous AI orchestrator dengan 9 sub-agent. $VT adalah utility token protocol — pay for runtime, stake for revenue share, govern (coming soon). Live di Base mainnet sejak 2026.</sub>

<sub>© 2026 Vexor Terminal. Artikel ini bukan financial advice. DYOR.</sub>
