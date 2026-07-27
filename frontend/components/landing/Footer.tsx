// Only links that actually go somewhere — page anchors and routes that exist.
const cols = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "#how" },
      { label: "Features", href: "#features" },
      { label: "Security", href: "#security" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Create an account", href: "/register" },
      { label: "Log in", href: "/login" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-ink pt-16 pb-8 text-white/70">
      <div className="container-x">
        <div className="grid gap-10 md:grid-cols-[1.8fr_1fr_1fr]">
          <div>
            <div className="mb-4 flex items-center gap-2.5 font-heading text-xl font-bold text-white">
              <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary-light to-accent" />
              CircleSafe
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-white/60">
              Transparent, trusted digital savings circles for communities everywhere.
            </p>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/40">
              CircleSafe records and verifies contributions and payouts — it never holds or moves
              your money.
            </p>
          </div>

          {cols.map((c) => (
            <div key={c.title}>
              <h3 className="mb-4 font-heading text-sm font-semibold text-white">{c.title}</h3>
              <ul className="space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className="text-sm text-white/60 transition-colors hover:text-white">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 text-center text-sm text-white/50">
          © {new Date().getFullYear()} CircleSafe. Built for the Zero to Query hackathon.
        </div>
      </div>
    </footer>
  );
}
