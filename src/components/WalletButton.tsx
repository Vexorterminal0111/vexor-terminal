"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function WalletButton({ compact = false }: { compact?: boolean }) {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
          >
            {!connected ? (
              <button
                onClick={openConnectModal}
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full bg-white text-black px-3.5 py-1.5 font-mono text-xs hover:bg-violet-300 hover:text-black transition-colors"
              >
                Connect Wallet
                <span aria-hidden>→</span>
              </button>
            ) : chain.unsupported ? (
              <button
                onClick={openChainModal}
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full bg-red-500 text-white px-3.5 py-1.5 font-mono text-xs hover:bg-red-600 transition-colors"
              >
                Wrong network
              </button>
            ) : (
              <div className="flex items-center gap-2">
                {!compact && (
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-white/70 hover:text-white hover:border-white/20 transition-colors"
                  >
                    {chain.hasIcon && chain.iconUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={chain.name ?? "Chain icon"}
                        src={chain.iconUrl}
                        className="h-3.5 w-3.5 rounded-full"
                      />
                    )}
                    {chain.name}
                  </button>
                )}
                <button
                  onClick={openAccountModal}
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full bg-white text-black px-3.5 py-1.5 font-mono text-xs hover:bg-violet-300 transition-colors"
                >
                  <span className="relative inline-flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-70 pulse-dot" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  {account.displayName}
                  {account.displayBalance && (
                    <span className="hidden sm:inline text-black/60">
                      · {account.displayBalance}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
