"use client";

import { motion } from "framer-motion";

export function SectionHeader({
  kicker,
  title,
  description,
}: {
  kicker?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {kicker && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/80"
        >
          <span className="h-px w-8 bg-cyan-300/40" />
          {kicker}
        </motion.div>
      )}
      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, delay: 0.05 }}
        className="font-mono text-3xl sm:text-4xl md:text-5xl tracking-tight text-white max-w-3xl"
      >
        {title}
      </motion.h2>
      {description && (
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-2xl text-base sm:text-lg text-white/65 leading-relaxed"
        >
          {description}
        </motion.p>
      )}
    </div>
  );
}
