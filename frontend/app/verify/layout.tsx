import Link from "next/link";

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-line bg-white">
        <div className="container-x flex h-16 items-center">
          <Link href="/" className="flex items-center gap-2.5 font-heading text-lg font-bold">
            <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-accent" />
            CircleSafe
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg px-6 py-14">{children}</main>
    </div>
  );
}
