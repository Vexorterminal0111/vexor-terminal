"use client";

import { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

interface Props {
  en: string;
  id: string;
}

type Lang = "en" | "id";

export function StakingDocs({ en, id }: Props) {
  const [lang, setLang] = useState<Lang>("en");
  const content = useMemo(() => (lang === "en" ? en : id), [lang, en, id]);

  return (
    <>
      <Nav />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 sm:px-6 md:px-8 py-16 sm:py-24">
          <div className="mb-8 flex items-center justify-between gap-4">
            <a
              href="/docs.html"
              className="font-mono text-xs text-white/55 hover:text-white transition-colors"
            >
              ← Back to docs
            </a>
            <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1 font-mono text-[10px] uppercase tracking-widest">
              <button
                onClick={() => setLang("en")}
                className={`px-3 py-1 rounded-full transition-colors ${
                  lang === "en"
                    ? "bg-cyan-500/20 text-cyan-200"
                    : "text-white/55 hover:text-white"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLang("id")}
                className={`px-3 py-1 rounded-full transition-colors ${
                  lang === "id"
                    ? "bg-cyan-500/20 text-cyan-200"
                    : "text-white/55 hover:text-white"
                }`}
              >
                ID
              </button>
            </div>
          </div>

          <div className="prose-vexor">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
