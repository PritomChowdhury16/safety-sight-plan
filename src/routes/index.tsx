import { createFileRoute, Link } from "@tanstack/react-router";
import { Sun, Droplets, ShieldCheck, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HeatSaathi AI — Safer Workdays in Extreme Heat" },
      { name: "description", content: "Free heat-safety plans for outdoor workers in India, based on live weather for your city." },
      { property: "og:title", content: "HeatSaathi AI — Safer Workdays in Extreme Heat" },
      { property: "og:description", content: "Free heat-safety plans for outdoor workers in India, based on live weather for your city." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen bg-sun">
      <div className="mx-auto max-w-5xl px-5 py-8">
        <header className="flex items-center gap-2 font-display text-xl font-extrabold">
          <Sun className="h-7 w-7 text-primary" /> HeatSaathi <span className="text-primary">AI</span>
        </header>
        <section className="py-16 md:py-24">
          <p className="mb-4 inline-block rounded-full bg-accent px-4 py-1 text-sm font-semibold text-accent-foreground">For construction, farm, delivery & street workers</p>
          <h1 className="max-w-3xl text-5xl font-extrabold leading-[1.05] md:text-7xl">Safer Workdays in <span className="text-primary">Extreme Heat.</span></h1>
          <p className="mt-6 max-w-2xl text-xl text-muted-foreground">
            Tell us your city and your work. We check today’s real weather and give you a simple, practical plan to stay safe — in English or Hindi.
          </p>
          <Link to="/plan" className="btn-big mt-10 bg-primary text-primary-foreground hover:bg-primary/90">
            Create My Safety Plan <ArrowRight className="h-5 w-5" />
          </Link>
        </section>
        <section className="grid gap-4 md:grid-cols-3">
          {[
            { i: Sun, t: "Live weather", d: "Real temperature and feels-like heat from Open-Meteo." },
            { i: Droplets, t: "Practical steps", d: "Water, shade, rest and timing tips for your workday." },
            { i: ShieldCheck, t: "Checked & honest", d: "Every step is verified. Demo data is always labelled." },
          ].map(({ i: Icon, t, d }) => (
            <div key={t} className="rounded-2xl border bg-card p-6">
              <Icon className="h-8 w-8 text-primary" />
              <h3 className="mt-3 text-lg font-bold">{t}</h3>
              <p className="mt-1 text-muted-foreground">{d}</p>
            </div>
          ))}
        </section>
        <p className="mt-10 text-sm text-muted-foreground">
          HeatSaathi gives general safety guidance, not medical advice. In an emergency call <strong>108</strong> or <strong>112</strong>.
        </p>
      </div>
    </main>
  );
}
