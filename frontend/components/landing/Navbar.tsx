"use client";

import { useEffect, useState } from "react";
import Logo from "@/components/Logo";

const links = [
  { label: "How it works", href: "#how" },
  { label: "Features", href: "#features" },
  { label: "Security", href: "#security" },
  { label: "FAQ", href: "#faq" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-ink/80 backdrop-blur-md shadow-lg" : "bg-transparent"
      }`}
    >
      <nav className="container-x flex items-center justify-between py-5">
        <a href="#" className="flex items-center gap-2.5 font-heading text-xl font-bold text-white">
          <Logo className="h-7 w-7" />
          CircleSafe
        </a>

        <ul className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="text-sm font-medium text-white/85 transition-colors hover:text-white">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <a href="/login" className="hidden text-sm font-semibold text-white sm:inline">
            Log in
          </a>
          <a href="/register" className="btn-primary !px-5 !py-2.5 !text-sm">
            Get Started
          </a>
        </div>
      </nav>
    </header>
  );
}
