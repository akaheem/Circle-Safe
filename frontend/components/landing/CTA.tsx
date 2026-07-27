import Reveal from "@/components/Reveal";

export default function CTA() {
  return (
    <section className="pb-24">
      <div className="container-x">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary-dark px-8 py-16 text-center md:px-16">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-primary-light/30 blur-3xl" />
            <h2 className="relative text-3xl font-bold tracking-tight text-white md:text-[40px]">
              Start your circle today
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-white/85">
              Bring transparency and trust to your savings group in minutes. Free to create your
              first circle.
            </p>
            <div className="relative mt-8 flex justify-center">
              <a href="#" className="btn bg-white text-primary hover:-translate-y-0.5 hover:bg-white/90">
                Create a Circle
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
