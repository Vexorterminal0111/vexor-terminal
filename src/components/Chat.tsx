"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { Send, Loader2, Terminal, Coins } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import { WalletButton } from "./WalletButton";

type Role = "user" | "assistant";
type Msg = { role: Role; content: string };

const CHAT_API =
  process.env.NEXT_PUBLIC_CHAT_API_URL || "";
const CHAT_API_BASIC_AUTH = process.env.NEXT_PUBLIC_CHAT_API_BASIC_AUTH || "";

const SAMPLE_PROMPTS = [
  "Audit a Solidity ERC-20 for me",
  "Summarize Base mainnet stats today",
  "Draft a launch tweet for $VEXOR",
  "Generate a memory recall query",
];

const SUGGESTED_GREETING: Msg = {
  role: "assistant",
  content:
    "Vexor.online · 9 sub-agents on standby. Ask anything — coding, research, content, on-chain ops. I route to the right agent.",
};

const AGENT_NAMES = new Set([
  "cipher",
  "atlas",
  "quill",
  "forge",
  "vector",
  "pulse",
  "halo",
  "prism",
  "nyx",
]);

function renderContent(text: string) {
  return text.split("\n").map((line, i) => {
    const bracket = line.match(/^>\s*\[([A-Za-z][\w.]*)\]\s*(.*)$/);
    const plain = line.match(/^>\s*([A-Za-z][\w.]*)\s*[:\-\u2014]\s*(.*)$/);
    const m = bracket || plain;
    if (m) {
      const tag = m[1].split(".")[0];
      if (AGENT_NAMES.has(tag.toLowerCase()) || bracket) {
        return (
          <div key={i} className="flex flex-wrap gap-x-2 gap-y-1">
            <span className="font-mono text-[11px] uppercase tracking-widest text-cyan-300 shrink-0">
              {m[1]}
            </span>
            <span className="text-white/80">{m[2]}</span>
          </div>
        );
      }
    }
    if (!line.trim()) return <div key={i} className="h-3" />;
    return <div key={i}>{line}</div>;
  });
}

export function Chat() {
  const { address, isConnected } = useAccount();
  const [messages, setMessages] = useState<Msg[]>([SUGGESTED_GREETING]);
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
      setError("Connect your wallet to chat with Vexor.");
      return;
    }
    setError(null);
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const conv = next.filter((m) => m !== SUGGESTED_GREETING);
      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      if (CHAT_API_BASIC_AUTH) {
        headers["authorization"] = `Basic ${CHAT_API_BASIC_AUTH}`;
      }
      const endpoint = CHAT_API ? `${CHAT_API}/api/chat` : "/api/chat";
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          wallet: address,
          messages: conv.map(({ role, content }) => ({ role, content })),
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.detail || `Upstream error (${res.status})`);
      }
      const data = (await res.json()) as { reply: string; cost_units: number };
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      setMsgCount((c) => c + 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
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
    <section id="chat" className="relative scroll-mt-24 py-16 sm:py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <SectionHeader
          kicker="Live Terminal"
          title="Chat with Vexor."
          description="Connect your wallet on Base and talk to the orchestrator. Vexor dispatches your prompt to the right sub-agent and streams a response."
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mt-10 sm:mt-12 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] via-white/[0.01] to-transparent"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/5 bg-white/[0.02] px-4 sm:px-5 py-2.5 sm:py-3">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/55">
              <Terminal className="h-3.5 w-3.5 text-cyan-300" />
              vexor@base:~$
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-white/45">
                <Coins className="h-3 w-3 text-cyan-300" />
                {msgCount > 0
                  ? `${(msgCount * 0.1).toFixed(1)} $VEXOR used`
                  : "0.1 $VEXOR per msg"}
              </div>
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 pulse-dot" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/55">
                Online
              </span>
            </div>
          </div>

          <div
            ref={scrollerRef}
            className="h-[380px] sm:h-[420px] overflow-y-auto px-4 py-5 sm:px-7 sm:py-8 space-y-5 font-mono text-sm"
          >
            {messages.map((m, i) => (
              <div key={i} className="space-y-1.5">
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">
                  {m.role === "user" ? (
                    <span>
                      <span className="text-cyan-300">$</span> you
                      {address && (
                        <span className="ml-2 text-white/30">
                          {address.slice(0, 6)}...{address.slice(-4)}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span>
                      <span className="text-cyan-300">›</span> vexor
                    </span>
                  )}
                </div>
                <div
                  className={`text-[13.5px] leading-relaxed ${
                    m.role === "user" ? "text-white/90" : "text-white/75"
                  }`}
                >
                  {renderContent(m.content)}
                </div>
              </div>
            ))}
            {loading && (
              <div className="space-y-1.5">
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">
                  <span className="text-cyan-300">›</span> vexor
                </div>
                <div className="flex items-center gap-2 text-cyan-300/80 text-[13.5px]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  dispatching to sub-agents...
                </div>
              </div>
            )}
          </div>

          {messages.length <= 1 && !loading && (
            <div className="border-t border-white/5 bg-white/[0.015] px-4 py-3 sm:px-7 flex flex-wrap gap-2">
              {SAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => void send(p)}
                  disabled={!isConnected || loading}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] text-white/70 hover:bg-white/[0.06] hover:text-white hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {error && (
            <div className="border-t border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 sm:px-7 font-mono text-[11px] text-red-300">
              ⚠ {error}
            </div>
          )}

          <div className="border-t border-white/5 bg-white/[0.02] p-3 sm:p-4">

            {!isConnected ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 px-2">
                <div className="font-mono text-xs text-white/55 text-center sm:text-left">
                  Connect your wallet on Base to chat with Vexor.
                </div>
                <WalletButton compact />
              </div>
            ) : (
              <div className="flex items-end gap-2 sm:gap-3">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Ask Vexor anything..."
                  rows={1}
                  maxLength={4000}
                  className="flex-1 resize-none rounded-xl border border-white/10 bg-background/60 px-4 py-3 font-mono text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/40 focus:bg-background/80 transition-colors"
                />
                <button
                  onClick={() => void send()}
                  disabled={!input.trim() || loading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white text-black px-4 py-3 font-mono text-xs hover:bg-cyan-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Send</span>
                </button>
              </div>
            )}
          </div>
        </motion.div>

        <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">
          Beta · Rate-limited · Hosted Llama 3.3 70B, routed by Vexor.
        </p>
      </div>
    </section>
  );
}
