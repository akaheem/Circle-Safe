import { Facebook, Twitter, Instagram, Linkedin } from "lucide-react";

const cols = [
  { title: "Product", links: ["How it works", "Features", "Security", "FAQ"] },
  { title: "Company", links: ["About", "Blog", "Careers", "Contact"] },
  { title: "Legal", links: ["Privacy", "Terms", "Cookies"] },
];

export default function Footer() {
  return (
    <footer className="bg-ink pt-16 pb-8 text-white/70">
      <div className="container-x">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="mb-4 flex items-center gap-2.5 font-heading text-xl font-bold text-white">
              <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary-light to-accent" />
              CircleSafe
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-white/60">
              Transparent, trusted digital savings circles for communities everywhere.
            </p>
            <div className="mt-5 flex gap-3">
              {[Facebook, Twitter, Instagram, Linkedin].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-primary hover:text-white"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {cols.map((c) => (
            <div key={c.title}>
              <h3 className="mb-4 font-heading text-sm font-semibold text-white">{c.title}</h3>
              <ul className="space-y-2.5">
                {c.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-sm text-white/60 transition-colors hover:text-white">
                      {l}
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
