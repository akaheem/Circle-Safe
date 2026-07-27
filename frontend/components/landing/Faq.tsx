import { Plus } from "lucide-react";
import Reveal from "@/components/Reveal";

const faqs = [
  {
    q: "What is a rotating savings circle (Ajo / Esusu / Susu)?",
    a: "A group where each member contributes a fixed amount every cycle, and the whole pot is given to one member per cycle, rotating until everyone has received once.",
  },
  {
    q: "Does CircleSafe hold or move my money?",
    a: "No. CircleSafe records and verifies contributions and payouts for full transparency; the actual cash still moves the way your group already trusts. Payment integrations are on the roadmap.",
  },
  {
    q: "How does it stop fraud?",
    a: "Every action is written to an append-only ledger that all members can see, so no one can hide a payment or quietly change the records.",
  },
  {
    q: "Can I control who gets paid first?",
    a: "Yes — the circle owner arranges the payout order with the visual Rules Builder, and everyone can see the full rotation.",
  },
];

export default function Faq() {
  return (
    <section id="faq" className="bg-white py-24">
      <div className="container-x max-w-3xl">
        <Reveal className="mb-12 text-center">
          <div className="section-tag">FAQ</div>
          <h2 className="mt-2.5 text-3xl font-bold tracking-tight md:text-[38px]">
            Questions, answered
          </h2>
        </Reveal>

        <div className="space-y-4">
          {faqs.map((f, i) => (
            <Reveal key={f.q} delay={i * 0.06}>
              <details className="group rounded-2xl border border-line bg-surface p-6 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-heading text-base font-semibold">
                  {f.q}
                  <Plus
                    size={20}
                    className="shrink-0 text-primary transition-transform duration-300 group-open:rotate-45"
                  />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
