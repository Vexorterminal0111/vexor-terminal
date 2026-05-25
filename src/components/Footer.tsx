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
              <VexorMark size={22} className="text-cyan-300" />
              <span className="font-mono text-sm tracking-tight text-white">
                VEXOR<span className="text-cyan-300">.</span>TERMINAL
              </span>
            </Link>
            <p className="mt-4 max-w-md text-sm text-white/55 leading-relaxed">
              An autonomous AI orchestrator with 9 sub-agents. Powered by the
              $VT token on Base — pay for runtime, stake for governance,
              earn from agent revenue.
            </p>
            <a
              href="https://basescan.org/address/0x2c684D666998436634EcEde1527EdA7975427Ba3"
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-md border border-cyan-400/30 bg-cyan-500/[0.06] px-3 py-2 font-mono text-[10px] sm:text-[11px] uppercase tracking-widest text-cyan-200 hover:text-white hover:border-cyan-400/60 transition-colors"
            >
              <span className="text-cyan-300">$VT</span>
              <span className="text-white">Verified on Basescan ↗</span>
            </a>
            <div className="mt-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-white/45 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.02]">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
              Built for Base · v0.1.0
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
                <a
                  href="#team"
                  className="text-white/70 hover:text-white transition-colors"
                >
                  Sub-Agents
                </a>
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
                  className="text-cyan-300 hover:text-white transition-colors"
                >
                  $VT Token
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
              On-Chain
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a
                  href="https://basescan.org/address/0x2c684D666998436634EcEde1527EdA7975427Ba3"
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-300 hover:text-white transition-colors font-mono text-xs"
                >
                  $VT on Base ↗
                </a>
              </li>
              <li>
                <a
                  href="https://basescan.org/address/0xE25f6243f848523c4577639e975B9F3E0fA57186"
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-300 hover:text-white transition-colors font-mono text-xs"
                >
                  RevShare on Base ↗
                </a>
              </li>
              <li>
                <a
                  href="https://sepolia.basescan.org/address/0x6a345b8390a67681764521d146853211dd089062"
                  target="_blank"
                  rel="noreferrer"
                  className="text-white/70 hover:text-cyan-300 transition-colors font-mono text-xs"
                >
                  Staking (testnet) ↗
                </a>
              </li>
              <li>
                <a
                  href="https://sepolia.basescan.org/address/0xd1850b4c2e663b45a49330d00637db78197be31c"
                  target="_blank"
                  rel="noreferrer"
                  className="text-white/70 hover:text-cyan-300 transition-colors font-mono text-xs"
                >
                  Governor (testnet) ↗
                </a>
              </li>
              <li>
                <a
                  href="https://docs.base.org/chain/network-information"
                  target="_blank"
                  rel="noreferrer"
                  className="text-white/70 hover:text-cyan-300 transition-colors font-mono text-xs"
                >
                  Base network ↗
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
                  className="text-cyan-300 hover:text-white transition-colors"
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
            Designed in the terminal. $VT live on Base.
          </div>
        </div>
      </div>
    </footer>
  );
}
