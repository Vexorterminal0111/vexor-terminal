"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

export function WalletButton({ compact = false }: { compact?: boolean }) {
  const { publicKey, connected, disconnect, wallet } = useWallet();
  const { setVisible } = useWalletModal();

  const displayAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : "";

  if (!connected) {
    return (
      <button
        onClick={() => setVisible(true)}
        type="button"
        className="inline-flex items-center gap-1.5 rounded-full bg-white text-black px-3.5 py-1.5 font-mono text-xs hover:bg-violet-300 hover:text-black transition-colors"
      >
        Connect Wallet
        <span aria-hidden>→</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {!compact && wallet && (
        <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-white/70">
          {wallet.adapter.name}
        </span>
      )}
      <button
        onClick={disconnect}
        type="button"
        className="inline-flex items-center gap-2 rounded-full bg-white text-black px-3.5 py-1.5 font-mono text-xs hover:bg-violet-300 transition-colors"
      >
        <span className="relative inline-flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-70 pulse-dot" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
        {displayAddress}
      </button>
    </div>
  );
}
