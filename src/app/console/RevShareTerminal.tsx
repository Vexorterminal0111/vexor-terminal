"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./console.module.css";

const RPC_URL = "https://mainnet.base.org";
const STAKING_CONTRACT = "0xE25f6243f848523c4577639e975B9F3E0fA57186";
const VT_TOKEN = "0x2c684D666998436634EcEde1527EdA7975427Ba3";
const OWNER = "0x0259abb884050E19e787cF7E271b6984E13BD79B";
const LOG_BLOCK_RANGE = 90000;
const LOG_CHUNK_SIZE = 9000;
const AUTO_REFRESH_MS = 300000;

const SEL_TOTAL_STAKED = "0x817b1cd2";
const SEL_ACC_REWARD = "0xcbce44b4";
const SEL_BALANCE_OF = "0x70a08231";

const TOPIC_REWARDS_PUSHED =
  "0xc1385e138caab1497b877640f7c64be52dcce8053e3e24b2b13d34af76d7d835";
const TOPIC_STAKED =
  "0x1449c6dd7851abc30abf37f57715f492010519147cc2652fbc38202c18a6ee90";
const TOPIC_WITHDRAWN =
  "0x92ccf450a286a957af52509bc1c9939d1a6a481783e142e41e2499f0bb66ebc6";

interface DexPair {
  priceUsd?: string;
  volume?: { h24?: number };
  fdv?: number;
  liquidity?: { usd?: number };
}
interface DexResponse {
  pairs: DexPair[] | null;
}
interface RawLog {
  blockNumber: string;
  transactionHash: string;
  topics: string[];
  data: string;
}
interface BlockInfo {
  timestamp: string;
}
interface RewardEntry {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  amount: bigint;
}

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "RPC error");
  return json.result;
}

function isRateLimitError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("rate limit") ||
    msg.includes("429") ||
    msg.includes("too many requests")
  );
}

async function rpcCallWithRetry(
  method: string,
  params: unknown[],
  retries = 3,
  backoffMs = 500
): Promise<unknown> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await rpcCall(method, params);
    } catch (err) {
      if (isRateLimitError(err) && attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, backoffMs * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}

function hexToBigInt(hex: string): bigint {
  return BigInt(hex.startsWith("0x") ? hex : "0x" + hex);
}

function formatVT(raw: bigint, decimals = 2): string {
  const scaled = raw / 10n ** 14n;
  const num = Number(scaled) / 10000;
  return num.toLocaleString("en", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatVTCompact(raw: bigint): string {
  const num = Number(raw / 10n ** 14n) / 10000;
  if (num > 0 && num < 0.01) {
    return num.toExponential(2) + " VT";
  }
  return formatVT(raw) + " VT";
}

function abbreviateUSD(val: number): string {
  if (val >= 1e6) return "$" + (val / 1e6).toFixed(2) + "M";
  if (val >= 1e3) return "$" + (val / 1e3).toFixed(2) + "K";
  return "$" + val.toFixed(val < 0.01 ? 8 : 2);
}

function truncAddr(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function relativeTime(unixSec: number): string {
  const diff = Math.floor(Date.now() / 1000 - unixSec);
  if (diff < 60) return diff + "s ago";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return (diff / 3600).toFixed(1) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

function absoluteTime(unixSec: number): string {
  return (
    new Date(unixSec * 1000).toISOString().replace("T", " ").slice(0, 19) +
    " UTC"
  );
}

async function fetchLogsChunked(
  topic: string,
  currentBlock: number,
  range: number,
  chunkSize: number
): Promise<RawLog[]> {
  const chunks: { fromBlock: string; toBlock: string }[] = [];
  for (let end = currentBlock; end > currentBlock - range; end -= chunkSize) {
    const start = Math.max(0, end - chunkSize + 1);
    chunks.push({
      fromBlock: "0x" + start.toString(16),
      toBlock: "0x" + end.toString(16),
    });
  }
  const results = await Promise.all(
    chunks.map((c) =>
      rpcCall("eth_getLogs", [
        {
          address: STAKING_CONTRACT,
          topics: [topic],
          fromBlock: c.fromBlock,
          toBlock: c.toBlock,
        },
      ]).catch(() => [] as RawLog[])
    )
  );
  return results.flat() as RawLog[];
}

export default function RevShareTerminal() {
  const [totalStaked, setTotalStaked] = useState<bigint | null>(null);
  const [accReward, setAccReward] = useState<string>("");
  const [poolBalance, setPoolBalance] = useState<bigint | null>(null);

  const [vtPrice, setVtPrice] = useState<string>("");
  const [volume24h, setVolume24h] = useState<number>(0);
  const [fdv, setFdv] = useState<number>(0);

  const [totalRewardsDistributed, setTotalRewardsDistributed] = useState<bigint>(0n);
  const [estApr, setEstApr] = useState<string>("—");
  const [avgPushInterval, setAvgPushInterval] = useState<string>("—");
  const [recentRewards, setRecentRewards] = useState<RewardEntry[]>([]);

  const [topStakers, setTopStakers] = useState<{ address: string; net: bigint }[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copied, setCopied] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    let currentBlock = 0;
    let ts = 0n;
    try {
      const [tsRaw, arRaw, balRaw, currentBlockHex] = await Promise.all([
        rpcCallWithRetry("eth_call", [
          { to: STAKING_CONTRACT, data: SEL_TOTAL_STAKED },
          "latest",
        ]),
        rpcCallWithRetry("eth_call", [
          { to: STAKING_CONTRACT, data: SEL_ACC_REWARD },
          "latest",
        ]),
        rpcCallWithRetry("eth_call", [
          {
            to: VT_TOKEN,
            data:
              SEL_BALANCE_OF +
              "000000000000000000000000" +
              STAKING_CONTRACT.slice(2).toLowerCase(),
          },
          "latest",
        ]),
        rpcCallWithRetry("eth_blockNumber", []),
      ]);
      ts = hexToBigInt(tsRaw as string);
      const bal = hexToBigInt(balRaw as string);
      currentBlock = Number(BigInt(currentBlockHex as string));
      setTotalStaked(ts);
      setAccReward(arRaw as string);
      setPoolBalance(bal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch pool stats");
      setLoading(false);
      return;
    }

    try {
      const dexRes = (await fetch(
        "https://api.dexscreener.com/latest/dex/tokens/" + VT_TOKEN
      ).then((r) => r.json())) as DexResponse;
      if (dexRes.pairs && dexRes.pairs.length > 0) {
        const best = dexRes.pairs.reduce((a, b) =>
          (b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a
        );
        setVtPrice(best.priceUsd || "0");
        setVolume24h(best.volume?.h24 || 0);
        setFdv(best.fdv || 0);
      }
    } catch (err) {
      console.error("DexScreener fetch failed:", err);
    }

    try {
      const [rewardLogs, stakedLogs, withdrawnLogs] = await Promise.all([
        fetchLogsChunked(TOPIC_REWARDS_PUSHED, currentBlock, LOG_BLOCK_RANGE, LOG_CHUNK_SIZE),
        fetchLogsChunked(TOPIC_STAKED, currentBlock, LOG_BLOCK_RANGE, LOG_CHUNK_SIZE),
        fetchLogsChunked(TOPIC_WITHDRAWN, currentBlock, LOG_BLOCK_RANGE, LOG_CHUNK_SIZE),
      ]);

      const rewardSumLifetime = rewardLogs.reduce(
        (sum, log) => sum + hexToBigInt("0x" + log.data.slice(2, 66)),
        0n
      );

      const uniqueBlockNums = [...new Set(rewardLogs.map((l) => l.blockNumber))];
      const blockTimestampMap = new Map<string, number>();
      const blockFetches = uniqueBlockNums.map((bn) => {
        const hex = "0x" + Number(BigInt(bn)).toString(16);
        return rpcCall("eth_getBlockByNumber", [hex, false]).then((blk) => {
          blockTimestampMap.set(
            bn,
            Number(BigInt((blk as BlockInfo).timestamp))
          );
        });
      });
      await Promise.all(blockFetches);

      const sortedRewardLogs = [...rewardLogs].sort(
        (a, b) => Number(BigInt(b.blockNumber)) - Number(BigInt(a.blockNumber))
      );
      const rewardEntries: RewardEntry[] = sortedRewardLogs.slice(0, 10).map((log) => ({
        txHash: log.transactionHash,
        blockNumber: Number(BigInt(log.blockNumber)),
        timestamp: blockTimestampMap.get(log.blockNumber) || 0,
        amount: hexToBigInt("0x" + log.data.slice(2, 66)),
      }));

      const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 86400;
      let rewardSum30d = 0n;
      for (const log of rewardLogs) {
        const logTs = blockTimestampMap.get(log.blockNumber) || 0;
        if (logTs >= thirtyDaysAgo) {
          rewardSum30d += hexToBigInt("0x" + log.data.slice(2, 66));
        }
      }

      setTotalRewardsDistributed(rewardSumLifetime);
      setRecentRewards(rewardEntries);

      if (ts > 0n && rewardSum30d > 0n) {
        const aprNum =
          ((Number(rewardSum30d / 10n ** 14n) / 10000) * (365 / 30)) /
          (Number(ts / 10n ** 14n) / 10000) *
          100;
        setEstApr(aprNum.toFixed(2) + "%");
      } else {
        setEstApr("—");
      }

      if (rewardEntries.length >= 2) {
        const sortedByTime = [...rewardEntries].sort(
          (a, b) => a.timestamp - b.timestamp
        );
        let totalGap = 0;
        for (let i = 1; i < sortedByTime.length; i++) {
          totalGap += sortedByTime[i].timestamp - sortedByTime[i - 1].timestamp;
        }
        const avgSec = totalGap / (sortedByTime.length - 1);
        const avgHrs = avgSec / 3600;
        setAvgPushInterval(
          avgHrs < 1
            ? (avgSec / 60).toFixed(1) + " minutes"
            : avgHrs.toFixed(1) + " hours"
        );
      } else {
        setAvgPushInterval("—");
      }

      const stakeMap = new Map<string, bigint>();
      for (const log of stakedLogs) {
        const addr = "0x" + log.topics[1].slice(26);
        const amount = hexToBigInt("0x" + log.data.slice(2, 66));
        stakeMap.set(addr, (stakeMap.get(addr) || 0n) + amount);
      }
      for (const log of withdrawnLogs) {
        const addr = "0x" + log.topics[1].slice(26);
        const amount = hexToBigInt("0x" + log.data.slice(2, 66));
        stakeMap.set(addr, (stakeMap.get(addr) || 0n) - amount);
      }
      const sorted = [...stakeMap.entries()]
        .filter(([, net]) => net > 0n)
        .sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0))
        .slice(0, 10)
        .map(([address, net]) => ({ address, net }));
      setTopStakers(sorted);
    } catch (err) {
      console.error("Event log fetch failed:", err);
    }

    setLastUpdated(
      new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC"
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      await fetchAll();
    };
    void run();
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        void fetchAll();
      }, AUTO_REFRESH_MS);
    }
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchAll]);

  const copyOwner = () => {
    navigator.clipboard.writeText(OWNER);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={styles.terminalRoot}>
      <header className={styles.header}>
        <h1>VEXOR TERMINAL // REVSHARE CONSOLE</h1>
        <p className={styles.tagline}>
          Real-time on-chain dashboard for $VT staking pool
        </p>
        <div className={styles.headerControls}>
          {lastUpdated && (
            <span className={styles.ts}>Last updated: {lastUpdated}</span>
          )}
          <button className={styles.btn} onClick={fetchAll} disabled={loading}>
            {loading ? "REFRESHING..." : "REFRESH"}
          </button>
          <button
            className={`${styles.btn} ${autoRefresh ? styles.btnActive : ""}`}
            onClick={() => setAutoRefresh((v) => !v)}
          >
            AUTO: {autoRefresh ? "ON" : "OFF"}
          </button>
        </div>
      </header>

      {error && (
        <div className={styles.errorBox}>
          <div>ERROR: {error}</div>
          <button className={styles.btn} onClick={fetchAll}>
            RETRY
          </button>
        </div>
      )}

      {loading && !totalStaked && (
        <div className={styles.loadingBox}>Loading...</div>
      )}

      <div className={styles.statRow}>
        <div className={styles.statCard}>
          <div className={styles.label}>VT PRICE</div>
          <div className={styles.value}>
            {vtPrice
              ? Number(vtPrice) < 0.01
                ? "$" + Number(vtPrice).toFixed(8)
                : "$" +
                  Number(vtPrice).toLocaleString("en", {
                    maximumFractionDigits: 6,
                  })
              : "—"}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.label}>24H VOLUME</div>
          <div className={styles.value}>
            {volume24h ? abbreviateUSD(volume24h) : "—"}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.label}>MARKET CAP / FDV</div>
          <div className={styles.value}>{fdv ? abbreviateUSD(fdv) : "—"}</div>
        </div>
      </div>

      <div className={styles.statRow}>
        <div className={styles.statCard}>
          <div className={styles.label}>TOTAL STAKED</div>
          <div className={styles.value}>
            {totalStaked !== null ? formatVT(totalStaked) + " VT" : "—"}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.label}>POOL VT BALANCE</div>
          <div className={styles.value}>
            {poolBalance !== null ? formatVT(poolBalance) + " VT" : "—"}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.label}>ACC REWARD PER TOKEN</div>
          <div className={`${styles.value} ${styles.valueSmall}`}>
            {accReward ? BigInt(accReward).toString() : "—"}
          </div>
        </div>
      </div>

      <div className={styles.statRow}>
        <div className={styles.statCard}>
          <div className={styles.label}>TOTAL REWARDS DISTRIBUTED</div>
          <div className={styles.value}>
            {totalRewardsDistributed > 0n
              ? formatVT(totalRewardsDistributed) + " VT"
              : "—"}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.label}>ESTIMATED APR</div>
          <div className={styles.value}>{estApr}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.label}>AVG PUSH INTERVAL</div>
          <div className={styles.value}>{avgPushInterval}</div>
        </div>
      </div>

      <div className={styles.ownerRow}>
        <span>OWNER:</span>
        <a
          className={styles.addr}
          href={`https://basescan.org/address/${OWNER}`}
          target="_blank"
          rel="noreferrer"
        >
          {truncAddr(OWNER)}
        </a>
        <button className={styles.copyBtn} onClick={copyOwner}>
          {copied ? "COPIED" : "COPY"}
        </button>
      </div>

      <div className={styles.tableWrap}>
        <div className={styles.sectionTitle}>TOP STAKERS LEADERBOARD</div>
        {topStakers.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>ADDRESS</th>
                <th>NET STAKE</th>
                <th>% SHARE</th>
              </tr>
            </thead>
            <tbody>
              {topStakers.map((s, i) => {
                const share =
                  totalStaked && totalStaked > 0n
                    ? ((Number(s.net / 10n ** 14n) / 10000) /
                        (Number(totalStaked / 10n ** 14n) / 10000)) *
                      100
                    : 0;
                return (
                  <tr key={s.address}>
                    <td className={styles.rank}>{i + 1}</td>
                    <td>
                      <a
                        href={`https://basescan.org/address/${s.address}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {truncAddr(s.address)}
                      </a>
                    </td>
                    <td className={styles.amount}>{formatVT(s.net)} VT</td>
                    <td className={styles.share}>{share.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          !loading && (
            <div className={styles.emptyNote}>
              No stakers found in recent blocks.
            </div>
          )
        )}
        <div className={styles.sectionNote}>
          Ranking based on Staked − Withdrawn events in last 90k blocks. Some
          entries may exceed current totalStaked due to staking cycles within
          window.
        </div>
      </div>

      <div className={styles.tableWrap}>
        <div className={styles.sectionTitle}>RECENT REWARDS PUSHED</div>
        {recentRewards.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>TIMESTAMP</th>
                <th>AMOUNT</th>
                <th>TX HASH</th>
              </tr>
            </thead>
            <tbody>
              {recentRewards.map((r) => (
                <tr key={r.txHash + r.blockNumber}>
                  <td>
                    {relativeTime(r.timestamp)}
                    <br />
                    <span className={styles.tsSubtle}>
                      {absoluteTime(r.timestamp)}
                    </span>
                  </td>
                  <td className={styles.amount}>{formatVTCompact(r.amount)}</td>
                  <td>
                    <a
                      href={`https://basescan.org/tx/${r.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {truncAddr(r.txHash)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          !loading && (
            <div className={styles.emptyNote}>
              No reward pushes found in recent blocks.
            </div>
          )
        )}
      </div>

      <footer className={styles.footer}>
        <a href="https://vexorterminal.com" target="_blank" rel="noreferrer">
          vexorterminal.com
        </a>
        <a
          href={`https://basescan.org/address/${STAKING_CONTRACT}`}
          target="_blank"
          rel="noreferrer"
        >
          basescan.org (staking)
        </a>
        <a
          href={`https://dexscreener.com/base/${VT_TOKEN}`}
          target="_blank"
          rel="noreferrer"
        >
          dexscreener.com
        </a>
        <a
          href="https://github.com/Vexorterminal0111/vexor-terminal"
          target="_blank"
          rel="noreferrer"
        >
          github.com
        </a>
      </footer>
    </div>
  );
}
