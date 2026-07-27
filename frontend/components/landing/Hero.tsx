"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import Lightfall from "@/components/Lightfall";

export default function Hero() {
  // A new array each render would look like a prop change to Lightfall.
  const colors = useMemo(() => ["#34E0A1", "#0FA968", "#F5B301"], []);

  return (
    <section id="home" className="relative flex min-h-[720px] items-center overflow-hidden bg-ink">
      {/* Recolored Lightfall animated background (Savanna Trust palette) */}
      <Lightfall
        colors={colors}
        backgroundColor="#07231B"
        streakCount={3}
        speed={0.18}
      />
      {/* readability gradient over the animation */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-ink/40 via-transparent to-ink/70" />

      <div className="container-x relative z-[2] grid items-center gap-12 pt-32 pb-20 md:grid-cols-[1.05fr_.95fr]">
        <div>
          <motion.span
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-block rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-[12.5px] font-semibold tracking-wide text-white"
          >
            Digital Ajo · Esusu · Susu · Tontine
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl font-bold leading-[1.08] tracking-tight text-white md:text-[52px]"
          >
            Run your savings circle —{" "}
            <span className="bg-gradient-to-r from-primary-light to-accent bg-clip-text text-transparent">
              transparent, trusted, digital.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-5 max-w-xl text-[17px] leading-relaxed text-white/80"
          >
            CircleSafe turns informal rotating savings groups into a secure, real-time,
            tamper-proof system. Everyone sees who paid, how much is in the pot, and whose
            payout is next.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-8 flex flex-wrap gap-4"
          >
            <a href="/register" className="btn-primary">Start a Circle</a>
            <a href="#how" className="btn-ghost">See how it works</a>
          </motion.div>
        </div>

        {/* Floating dashboard preview */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="rounded-3xl border border-white/15 bg-white/[0.07] p-6 shadow-2xl backdrop-blur-md"
        >
          <div className="mb-5 flex items-center justify-between">
            <b className="font-heading text-[15px] text-white">Lagos Traders Circle</b>
            <span className="rounded-full bg-primary-light px-3 py-1 text-[11px] font-bold text-ink">
              Cycle 7 / 10
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {/* Illustrative figures, kept consistent: 7 of 10 members × ₦10,000 = ₦70,000. */}
            <Tile label="Current Pot" value="₦70,000" accent />
            <Tile label="Members Paid" value="7 / 10" />
            <Tile label="Next Recipient" value="Sarah" />
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <div className="mb-1.5 text-[11px] text-white/60">Completion</div>
              <div className="font-heading text-[22px] font-bold text-white">70%</div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
                <div className="h-full w-[70%] rounded-full bg-gradient-to-r from-primary to-primary-light" />
              </div>
            </div>
          </div>
          <div className="mt-4 text-center text-[11px] text-white/40">
            Example circle — not live data
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
      <div className="mb-1.5 text-[11px] text-white/60">{label}</div>
      <div className={`font-heading text-[22px] font-bold ${accent ? "text-accent" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}
