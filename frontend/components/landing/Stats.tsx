"use client";

import CountUp from "react-countup";
import { motion } from "framer-motion";

// Facts about the app that actually runs — count them in lib/server/resources.ts and schema.sql.
const stats = [
  { prefix: "", value: 39, suffix: "", label: "API endpoints in the app", decimals: 0 },
  { prefix: "", value: 11, suffix: "", label: "Postgres tables behind it", decimals: 0 },
  { prefix: "", value: 1, suffix: "", label: "Append-only audit log", decimals: 0 },
  { prefix: "", value: 100, suffix: "%", label: "Auditable history", decimals: 0 },
];

export default function Stats() {
  return (
    <section className="pb-24">
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="grid gap-8 rounded-3xl bg-ink px-6 py-14 sm:grid-cols-2 lg:grid-cols-4"
        >
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-heading text-4xl font-bold text-white md:text-[42px]">
                {s.prefix}
                <CountUp end={s.value} decimals={s.decimals} duration={2} enableScrollSpy scrollSpyOnce />
                <span className="text-accent">{s.suffix}</span>
              </div>
              <div className="mt-1.5 text-sm text-white/65">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
