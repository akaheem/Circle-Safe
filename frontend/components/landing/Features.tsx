import { ScrollText, SlidersHorizontal, ShieldCheck, Activity } from "lucide-react";
import Reveal from "@/components/Reveal";

const features = [
  {
    icon: ScrollText,
    title: "Append-only Ledger",
    desc: "Every contribution and payout is a permanent, timestamped record. Nothing can be quietly edited or deleted.",
  },
  {
    icon: SlidersHorizontal,
    title: "Visual Rules Builder",
    desc: "Drag members into payout order and set contribution rules — no spreadsheets, no confusion, no arguments.",
  },
  {
    icon: ShieldCheck,
    title: "Trust Scores",
    desc: "Each member earns a reliability score from on-time contributions — building confidence, not blame.",
  },
  {
    icon: Activity,
    title: "Real-time Dashboard",
    desc: "Live pot totals, payments, and payout rotation update instantly for every member of the circle.",
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24">
      <div className="container-x">
        <Reveal className="mx-auto mb-14 max-w-xl text-center">
          <div className="section-tag">Why CircleSafe</div>
          <h2 className="mt-2.5 text-3xl font-bold tracking-tight md:text-[38px]">
            Everything your circle needs to stay honest
          </h2>
          <p className="mt-3.5 text-base leading-relaxed text-muted">
            Built on a transparent ledger so no one can cheat — and no one has to argue.
          </p>
        </Reveal>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.08}>
              <div className="h-full rounded-2xl border border-line bg-white p-7 shadow-card transition-transform duration-200 hover:-translate-y-1.5">
                <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <f.icon size={26} strokeWidth={2} />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
