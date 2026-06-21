"use client";

import Link from "next/link";
import { VexorMark } from "./Logo";

export function Footer() {
  return (
    <footer className="relative mt-16 sm:mt-24 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8 py-10 sm:py-14">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-10">
          <div className="col-span-2 md:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2.5 group">
              <VexorMark size={22} className="text-violet-300" />
              <span className="font-mono text-sm tracking-tight text-white">
                VEXOR<span className="text-violet-300">.</span>TERMINAL
              </span>
            </Link>
            <p className="mt-4 max-w-md text-sm text-white/55 leading-relaxed">
              Programmable AI orchestration on Solana. Nine specialized
              sub-agents, multi-model routing, and the $VEXOR token
              economy — runtime payment, staking, and governance —
              launching soon.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-md border border-violet-400/30 bg-violet-500/[0.06] px-3 py-2 font-mono text-[10px] sm:text-[11px] uppercase tracking-widest text-violet-200">
              <span className="text-violet-300">$VEXOR</span>
              <span className="text-white">Token launch coming soon</span>
            </div>
            <div className="mt-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/45 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.02]">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-300" />
              Built for Solana · v0.1.0
            </div>
            <div className="mt-5">
              <a
                href="https://orynth.dev/projects/vexor-terminal"
                target="_blank"
                rel="noreferrer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://orynth.dev/api/badge/vexor-terminal?theme=light&style=default"
                  alt="Featured on Orynth"
                  width={200}
                  height={62}
                  className="opacity-70 hover:opacity-100 transition-opacity"
                />
              </a>
            </div>
          </div>

          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-white/45">
              Product
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a
                  href="#about"
                  className="text-white/70 hover:text-white transition-colors"
                >
                  About
                </a>
              </li>
              <li>
                <Link
                  href="/agents"
                  className="text-white/70 hover:text-white transition-colors"
                >
                  Sub-Agents
                </Link>
              </li>
              <li>
                <a
                  href="#usecases"
                  className="text-white/70 hover:text-white transition-colors"
                >
                  Use Cases
                </a>
              </li>
              <li>
                <a
                  href="#token"
                  className="text-violet-300 hover:text-white transition-colors"
                >
                  $VEXOR Token
                </a>
              </li>
              <li>
                <a
                  href="#console"
                  className="text-white/70 hover:text-white transition-colors"
                >
                  Console
                </a>
              </li>
              <li>
                <a
                  href="/docs.html"
                  className="text-white/70 hover:text-white transition-colors"
                >
                  Docs
                </a>
              </li>
            </ul>
          </div>

          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-white/45">
              Network
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <span className="text-white/70 font-mono text-xs">
                  $VEXOR token — coming soon
                </span>
              </li>
              <li>
                <span className="text-white/70 font-mono text-xs">
                  Staking — coming soon
                </span>
              </li>
              <li>
                <span className="text-white/70 font-mono text-xs">
                  Governance — coming soon
                </span>
              </li>
              <li>
                <a
                  href="https://solana.com/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="text-white/70 hover:text-violet-300 transition-colors font-mono text-xs"
                >
                  Solana network ↗
                </a>
              </li>
            </ul>
          </div>

          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-white/45">
              Connect
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a
                  href="https://t.me/VexorAeonWatchtowerbot?startgroup=true"
                  target="_blank"
                  rel="noreferrer"
                  className="text-violet-300 hover:text-white transition-colors"
                >
                  Add Bot to Group ↗
                </a>
              </li>
              <li>
                <a
                  href="https://t.me/VexorAeonWatchtowerbot"
                  target="_blank"
                  rel="noreferrer"
                  className="text-white/70 hover:text-white transition-colors"
                >
                  Telegram (DM)
                </a>
              </li>
              <li>
                <a
                  href="https://x.com/vexorterminal"
                  target="_blank"
                  rel="noreferrer"
                  className="text-white/70 hover:text-white transition-colors"
                >
                  X / Twitter
                </a>
              </li>
              <li>
                <a
                  href="https://warpcast.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-white/70 hover:text-white transition-colors"
                >
                  Farcaster
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/Vexorterminal0111"
                  target="_blank"
                  rel="noreferrer"
                  className="text-white/70 hover:text-white transition-colors"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="mailto:vexorterminal@gmail.com"
                  className="text-white/70 hover:text-white transition-colors"
                >
                  Email
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 sm:mt-12 pt-6 border-t border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-2 sm:gap-3">
          <div className="font-mono text-[10px] sm:text-[11px] text-white/40">
            © {new Date().getFullYear()} Vexor Terminal. All rights reserved.
          </div>
          <div className="font-mono text-[10px] sm:text-[11px] text-white/40">
            Vexor Terminal · $VEXOR launching on Solana soon.
          </div>
        </div>
      </div>
    </footer>
  );
}
