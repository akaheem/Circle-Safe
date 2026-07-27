import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <div className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
        <div className="pointer-events-none absolute bottom-10 right-0 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link href="/" className="flex items-center gap-2.5 font-heading text-xl font-bold text-white">
            <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary-light to-accent" />
            CircleSafe
          </Link>
          <div>
            <h2 className="max-w-sm font-heading text-3xl font-bold leading-tight text-white">
              Transparent savings circles your community can trust.
            </h2>
            <p className="mt-4 max-w-sm text-white/70">
              Every contribution and payout — recorded, visible, and tamper-proof.
            </p>
          </div>
          <p className="text-sm text-white/40">© {new Date().getFullYear()} CircleSafe</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
