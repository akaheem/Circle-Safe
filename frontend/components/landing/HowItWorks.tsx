import Reveal from "@/components/Reveal";

const steps = [
  { n: "01", title: "Create a circle", desc: "Set the contribution amount, frequency, size, and currency in a quick guided wizard." },
  { n: "02", title: "Invite & order", desc: "Invite members and drag them into the payout rotation with the visual Rules Builder." },
  { n: "03", title: "Contribute & confirm", desc: "Members record contributions each cycle; the treasurer confirms — all logged to the ledger." },
  { n: "04", title: "Payout rotates", desc: "The owner records the payout to whoever holds the next position; the recipient confirms and the cycle advances." },
];

export default function HowItWorks() {
  return (
    <section id="how" className="bg-white py-24">
      <div className="container-x">
        <Reveal className="mx-auto mb-14 max-w-xl text-center">
          <div className="section-tag">How it works</div>
          <h2 className="mt-2.5 text-3xl font-bold tracking-tight md:text-[38px]">
            From cash-in-a-notebook to fully transparent
          </h2>
          <p className="mt-3.5 text-base leading-relaxed text-muted">
            The same trusted tradition your community already runs — just safer and clearer.
          </p>
        </Reveal>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.1}>
              <div className="relative rounded-2xl border border-line bg-surface p-7">
                <div className="mb-4 font-heading text-4xl font-bold text-primary/25">{s.n}</div>
                <h3 className="mb-2 text-lg font-semibold">{s.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
