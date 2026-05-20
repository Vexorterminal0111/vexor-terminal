"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { Send, Loader2, Terminal, Coins } from "lucide-react";
import { WalletButton } from "./WalletButton";
import type { AgentPersona } from "@/lib/agents";

type Role = "user" | "assistant";
type Msg = { role: Role; content: string };

const CHAT_API = process.env.NEXT_PUBLIC_CHAT_API_URL || "";
const CHAT_API_BASIC_AUTH = process.env.NEXT_PUBLIC_CHAT_API_BASIC_AUTH || "";

type ChatReply = { reply: string; cost_units: number };

async function sendOnce(
  endpoint: string,
  headers: Record<string, string>,
  body: string,
): Promise<ChatReply> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 30_000);
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
      mode: "cors",
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as {
      detail?: string;
    };
    throw new Error(errBody.detail || `Upstream error (HTTP ${res.status})`);
  }
  return (await res.json()) as ChatReply;
}

function isNetworkError(e: unknown): boolean {
  return (
    e instanceof TypeError && /fetch|network|load failed/i.test(e.message)
  );
}

async function sendWithRetry(
  endpoint: string,
  headers: Record<string, string>,
  body: string,
): Promise<ChatReply> {
  const delays = [1_000, 3_000];
  let lastErr: unknown;
  for (let attempt = 0; attempt < 1 + delays.length; attempt++) {
    try {
      return await sendOnce(endpoint, headers, body);
    } catch (e) {
      lastErr = e;
      const retriable = isNetworkError(e);
      if (!retriable || attempt === delays.length) throw e;
      const wait = delays[attempt];
      console.warn(
        `[AgentChat:${headers["x-agent"] ?? "?"}] attempt ${attempt + 1} failed, retrying in ${wait}ms`,
        e,
      );
      await new Promise((r) => window.setTimeout(r, wait));
    }
  }
  throw lastErr;
}

function renderContent(text: string, accent: string) {
  return text.split("\n").map((line, i) => {
    const bracket = line.match(/^>\s*\[([A-Za-z][\w.]*)\]\s*(.*)$/);
    if (bracket) {
      return (
        <div key={i} className="flex flex-wrap gap-x-2 gap-y-1">
          <span
            className="font-mono text-[11px] uppercase tracking-widest shrink-0"
            style={{ color: accent }}
          >
            {bracket[1]}
          </span>
          <span className="text-white/80">{bracket[2]}</span>
        </div>
      );
    }
    if (!line.trim()) return <div key={i} className="h-3" />;
    return <div key={i}>{line}</div>;
  });
}

export function AgentChat({ agent }: { agent: AgentPersona }) {
  const { address, isConnected } = useAccount();
  // Stable greeting reference — captured in state on first render so it
  // keeps the same object identity across re-renders. Building the greeting
  // inline in the component body would produce a new reference per render,
  // breaking the `messages.filter((m) => m !== greeting)` strip below and
  // leaking the synthetic greeting to the API as fake conversation context.
  // useState's lazy init runs exactly once, so `greeting === messages[0]`
  // stays true for the lifetime of the mount.
  const [greeting] = useState<Msg>(() => ({
    role: "assistant",
    content: `${agent.name} online. ${agent.pitch} Ready when you are.`,
  }));
  const [messages, setMessages] = useState<Msg[]>(() => [greeting]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msgCount, setMsgCount] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function send(promptOverride?: string) {
    const text = (promptOverride ?? input).trim();
    if (!text || loading) return;
    if (!isConnected || !address) {
      setError("Connect your wallet to chat with this agent.");
      return;
    }
    setError(null);
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);

    const endpoint = CHAT_API ? `${CHAT_API}/api/chat` : "/api/chat";
    try {
      const conv = next.filter((m) => m !== greeting);
      const body = JSON.stringify({
        wallet: address,
        agent: agent.slug,
        messages: conv.map(({ role, content }) => ({ role, content })),
      });
      const headers: Record<string, string> = {
        "content-type": "application/json",
        "x-agent": agent.slug,
      };
      if (CHAT_API_BASIC_AUTH) {
        headers["authorization"] = `Basic ${CHAT_API_BASIC_AUTH}`;
      }
      const data = await sendWithRetry(endpoint, headers, body);
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      setMsgCount((c) => c + 1);
    } catch (e) {
      console.error(`[AgentChat:${agent.slug}] send failed`, e);
      let msg: string;
      if (e instanceof DOMException && e.name === "AbortError") {
        msg = `Request timed out after 30s — ${agent.name} is taking too long. Try again.`;
      } else if (
        e instanceof TypeError &&
        /fetch|network|load failed/i.test(e.message)
      ) {
        const host =
          typeof window !== "undefined"
            ? window.location.host
            : "vexorterminal.com";
        msg = `Network error reaching ${host}/api/chat after 3 attempts. Try a different browser or check your connection.`;
      } else if (e instanceof Error) {
        msg = e.message;
      } else {
        msg = "Unknown error";
      }
      setError(msg);
      setMessages((m) => m.slice(0, -1));
      setInput(text);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] via-white/[0.01] to-transparent">
      <div className="flex items-center justify-between gap-3 border-b border-white/5 bg-white/[0.02] px-4 sm:px-5 py-2.5 sm:py-3">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
          <Terminal className="h-3.5 w-3.5" style={{ color: agent.accent }} />
          {agent.slug}@base:~$
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-white/45">
            <Coins className="h-3 w-3" style={{ color: agent.accent }} />
            {msgCount > 0
              ? `${(msgCount * 0.1).toFixed(1)} $VT used`
              : "0.1 $VT per msg"}
          </div>
          <span className="relative inline-flex h-1.5 w-1.5">
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-75 pulse-dot"
              style={{ background: agent.accent }}
            />
            <span
              className="relative inline-flex h-1.5 w-1.5 rounded-full"
              style={{ background: agent.accent }}
            />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/55">
            Online
          </span>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="h-[420px] sm:h-[480px] overflow-y-auto px-4 py-5 sm:px-7 sm:py-8 space-y-5 font-mono text-sm"
      >
        {messages.map((m, i) => (
          <div key={i} className="space-y-1.5">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">
              {m.role === "user" ? (
                <span>
                  <span style={{ color: agent.accent }}>$</span> you
                  {address && (
                    <span className="ml-2 text-white/30">
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </span>
                  )}
                </span>
              ) : (
                <span>
                  <span style={{ color: agent.accent }}>›</span>{" "}
                  {agent.name.toLowerCase()}
                </span>
              )}
            </div>
            <div
              className={`text-[13.5px] leading-relaxed ${
                m.role === "user" ? "text-white/90" : "text-white/75"
              }`}
            >
              {renderContent(m.content, agent.accent)}
            </div>
          </div>
        ))}
        {loading && (
          <div className="space-y-1.5">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">
              <span style={{ color: agent.accent }}>›</span>{" "}
              {agent.name.toLowerCase()}
            </div>
            <div
              className="flex items-center gap-2 text-[13.5px]"
              style={{ color: agent.accent }}
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="opacity-80">dispatching…</span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-white/5 px-4 sm:px-5 py-3 sm:py-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {agent.samples.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void send(s)}
              disabled={loading || !isConnected}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/70 transition-colors hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
        {!isConnected && (
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.04] px-3 py-2 text-[12px] text-amber-200/90">
            <span>Connect your wallet on Base to chat with {agent.name}.</span>
            <WalletButton />
          </div>
        )}
        {error && (
          <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/[0.05] px-3 py-2 text-[12px] text-rose-200/90">
            {error}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={`Message ${agent.name}…`}
            disabled={loading}
            className="flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 font-mono text-sm text-white placeholder:text-white/30 outline-none focus:border-white/25 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={loading || !input.trim() || !isConnected}
            className="rounded-xl border px-3.5 py-2.5 text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              borderColor: `${agent.accent}66`,
              background: `${agent.accent}11`,
            }}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
