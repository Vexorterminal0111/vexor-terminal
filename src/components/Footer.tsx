"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="relative mt-24 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <Link href="/" className="inline-flex items-center gap-2 group">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-60 pulse-dot" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" />
              </span>
              <span className="font-mono text-sm tracking-tight text-white">
                VEXOR<span className="text-cyan-300">.</span>TERMINAL
              </span>
            </Link>
            <p className="mt-4 max-w-md text-sm text-white/55 leading-relaxed">
              An autonomous AI orchestrator with 9 sub-agents. Powered by the
              $VEXOR token on Base — pay for runtime, stake for governance,
              earn from agent revenue.
            </p>
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
                  $VEXOR Token
                </a>
              </li>
              <li>
                <a
                  href="#services"
                  className="text-white/70 hover:text-white transition-colors"
                >
                  Services
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
                  href="https://x.com/"
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
                  href="mailto:habibullahsuteja@gmail.com"
                  className="text-white/70 hover:text-white transition-colors"
                >
                  Email
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="font-mono text-[11px] text-white/40">
            © {new Date().getFullYear()} Vexor Terminal. All rights reserved.
          </div>
          <div className="font-mono text-[11px] text-white/40">
            Designed in the terminal. $VEXOR launching on Base.
          </div>
        </div>
      </div>
    </footer>
  );
}
