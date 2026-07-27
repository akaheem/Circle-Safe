import { Lock, KeyRound, FileCheck2, Gauge } from "lucide-react";
import Reveal from "@/components/Reveal";

const points = [
  { icon: Lock, title: "Encrypted & hashed", desc: "Passwords hashed with BCRYPT; all traffic over HTTPS/TLS." },
  { icon: KeyRound, title: "JWT + role access", desc: "Signed tokens and role-based permissions on every action." },
  { icon: FileCheck2, title: "Tamper-evident ledger", desc: "Append-only records — history can never be silently rewritten." },
  { icon: Gauge, title: "Abuse protection", desc: "Rate limiting and strict input validation on every endpoint." },
];

export default function Security() {
  return (
    <section id="security" className="py-24">
      <div className="container-x grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <div className="section-tag">Security</div>
          <h2 className="mt-2.5 text-3xl font-bold tracking-tight md:text-[38px]">
            Built like a real financial product
          </h2>
          <p className="mt-3.5 max-w-lg text-base leading-relaxed text-muted">
            Trust is the whole point of a savings circle — so CircleSafe is engineered with
            production-grade security from day one, not bolted on later.
          </p>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2">
          {points.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.08}>
              <div className="h-full rounded-2xl border border-line bg-white p-6 shadow-card">
                <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-accent/15 text-accent-dark">
                  <p.icon size={22} strokeWidth={2} />
                </div>
                <h3 className="mb-1.5 text-base font-semibold">{p.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{p.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
