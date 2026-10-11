import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Circle, Loader2, Sun, XCircle, ExternalLink } from "lucide-react";
import { fetchWeather } from "@/lib/weather.functions";
import { assess, buildPlan, verify, LEVELS, type WorkerInput, type WeatherData, type Assessment, type Action, type Check } from "@/lib/heat";

export const Route = createFileRoute("/plan")({
  head: () => ({
    meta: [
      { title: "Create My Heat Safety Plan — HeatSaathi AI" },
      { name: "description", content: "Enter your city and work details to get a heat-safety plan based on live weather." },
      { property: "og:title", content: "Create My Heat Safety Plan — HeatSaathi AI" },
      { property: "og:description", content: "Enter your city and work details to get a heat-safety plan based on live weather." },
    ],
  }),
  component: PlanPage,
});

const schema = z.object({
  city: z.string().trim().min(2, "Enter your city (at least 2 letters)").max(80),
  work: z.string().min(1, "Choose your type of work"),
  hours: z.coerce.number({ message: "Enter hours" }).min(1, "At least 1 hour").max(16, "Maximum 16 hours"),
  shade: z.enum(["yes", "no"], { message: "Select yes or no" }),
  water: z.enum(["yes", "no"], { message: "Select yes or no" }),
  lang: z.enum(["en", "hi"]),
  symptoms: z.string().max(500, "Keep under 500 characters"),
});

const WORK = ["Construction", "Farming / agriculture", "Delivery / driving", "Street vending", "Traffic / security", "Sanitation", "Brick kiln / factory yard", "Other outdoor work"];

type Status = "idle" | "running" | "done" | "failed" | "skipped";
interface AgentState { status: Status; output?: string }
const AGENTS = ["Weather Agent", "Risk Assessment Agent", "Action Plan Agent", "Verification Agent"] as const;
const idle = () => AGENTS.map(() => ({ status: "idle" as Status }));

const DEMO: Omit<WeatherData, "city"> = {
  region: "Demo", latitude: 0, longitude: 0, temperature: 41, apparent: 44, humidity: 30,
  maxToday: 43, maxApparentToday: 46, time: "2026-05-20T13:00", timezone: "Asia/Kolkata", source: "demo",
};

function PlanPage() {
  const getWeather = useServerFn(fetchWeather);
  const [form, setForm] = useState({ city: "", work: "", hours: "8", shade: "", water: "", lang: "en", symptoms: "" });
  const [errors, setErrors] = useState<Partial<Record<"city" | "work" | "hours" | "shade" | "water" | "symptoms", string>>>({});
  const [agents, setAgents] = useState<AgentState[]>(idle());
  const [weatherErr, setWeatherErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ w: WeatherData; a: Assessment; plan: Action[]; checks: Check[]; input: WorkerInput } | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const upd = (i: number, s: AgentState) => setAgents((a) => a.map((x, j) => (j === i ? s : x)));

  function runPipeline(w: WeatherData, input: WorkerInput) {
    upd(1, { status: "running" });
    const a = assess(w, input);
    upd(1, { status: "done", output: `Level ${a.level}: ${LEVELS[a.level].en}. ${a.reasons.join("; ")}.` });
    upd(2, { status: "running" });
    const plan = buildPlan(a, input);
    upd(2, { status: "done", output: `${plan.length} actions generated (rule-based).` });
    upd(3, { status: "running" });
    const checks = verify(w, a, plan, input);
    const fails = checks.filter((c) => !c.pass).length;
    upd(3, { status: "done", output: `${checks.length - fails}/${checks.length} checks passed${fails ? ` — ${fails} warning(s)` : ""}.` });
    setResult({ w, a, plan, checks, input });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = schema.safeParse(form);
    if (!r.success) {
      const errs: Record<string, string> = {};
      r.error.issues.forEach((i) => (errs[String(i.path[0])] ||= i.message));
      setErrors(errs as typeof errors);
      return;
    }
    setErrors({});
    setResult(null);
    setWeatherErr(null);
    const d = r.data;
    const input: WorkerInput = { city: d.city, work: d.work, hours: d.hours, shade: d.shade === "yes", water: d.water === "yes", lang: d.lang, symptoms: d.symptoms };
    setAgents([{ status: "running" }, { status: "idle" }, { status: "idle" }, { status: "idle" }]);
    setBusy(true);
    try {
      const res = await getWeather({ data: { city: d.city } });
      if (!res.ok || !res.weather) {
        const errMsg = res.error ?? "Unknown weather error";
        upd(0, { status: "failed", output: errMsg });
        [1, 2, 3].forEach((i) => upd(i, { status: "skipped", output: "Not run — no weather data." }));
        setWeatherErr(errMsg);
        return;
      }
      upd(0, { status: "done", output: `${res.weather.city}: ${res.weather.temperature}°C, feels like ${res.weather.apparent}°C (Open-Meteo).` });
      runPipeline(res.weather, input);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Request failed";
      upd(0, { status: "failed", output: msg });
      [1, 2, 3].forEach((i) => upd(i, { status: "skipped", output: "Not run — no weather data." }));
      setWeatherErr(msg);
    } finally {
      setBusy(false);
    }
  }

  function useDemo() {
    const d = schema.parse(form);
    const input: WorkerInput = { city: d.city, work: d.work, hours: d.hours, shade: d.shade === "yes", water: d.water === "yes", lang: d.lang, symptoms: d.symptoms };
    upd(0, { status: "failed", output: `Live fetch failed. Using DEMONSTRATION data instead.` });
    runPipeline({ ...DEMO, city: d.city }, input);
    setWeatherErr(null);
  }

  return (
    <main className="min-h-screen bg-sun">
      <div className="mx-auto max-w-6xl px-5 py-8">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-extrabold">
          <Sun className="h-7 w-7 text-primary" /> HeatSaathi <span className="text-primary">AI</span>
        </Link>
        <h1 className="mt-8 text-4xl font-extrabold md:text-5xl">Create my safety plan</h1>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
          <form onSubmit={submit} noValidate className="space-y-5 rounded-2xl border bg-card p-6">
            <Field label="Your city in India" error={errors.city}>
              <input className="field" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Nagpur" />
            </Field>
            <Field label="Type of outdoor work" error={errors.work}>
              <select className="field" value={form.work} onChange={(e) => set("work", e.target.value)}>
                <option value="">Select…</option>
                {WORK.map((w) => <option key={w}>{w}</option>)}
              </select>
            </Field>
            <Field label="Expected hours outdoors today" error={errors.hours}>
              <input className="field" type="number" min={1} max={16} value={form.hours} onChange={(e) => set("hours", e.target.value)} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <YesNo label="Access to shade?" value={form.shade} onChange={(v) => set("shade", v)} error={errors.shade} />
              <YesNo label="Access to drinking water?" value={form.water} onChange={(v) => set("water", v)} error={errors.water} />
            </div>
            <Field label="Preferred language">
              <div className="flex gap-3">
                {([["en", "English"], ["hi", "हिन्दी"]] as const).map(([v, l]) => (
                  <Choice key={v} active={form.lang === v} onClick={() => set("lang", v)}>{l}</Choice>
                ))}
              </div>
            </Field>
            <Field label="Any symptoms right now? (optional)" error={errors.symptoms}>
              <div className="mb-2 flex gap-2 rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                If you or a co-worker feel confused, faint, stop sweating, or have a very high temperature — stop work, move to shade and call 108 or 112 now. Do not wait for this app.
              </div>
              <textarea className="field min-h-24" value={form.symptoms} onChange={(e) => set("symptoms", e.target.value)} placeholder="e.g. headache, dizziness" />
            </Field>
            <button type="submit" disabled={busy} className="btn-big w-full bg-primary text-primary-foreground hover:bg-primary/90">
              {busy ? <><Loader2 className="h-5 w-5 animate-spin" /> Checking weather…</> : "Get My Safety Plan"}
            </button>
          </form>

          <aside className="h-fit rounded-2xl border bg-card p-6">
            <h2 className="text-xl font-bold">Agent activity</h2>
            <ol className="mt-4 space-y-4">
              {AGENTS.map((name, i) => <AgentRow key={name} name={name} s={agents[i] ?? { status: "idle" }} />)}
            </ol>
            <p className="mt-4 text-xs text-muted-foreground">Agents 2–4 are transparent rule-based steps today; ready to be upgraded to a server-side Gemini model.</p>
          </aside>
        </div>

        {weatherErr && (
          <div role="alert" className="mt-6 rounded-2xl border-2 border-destructive/40 bg-card p-6">
            <h2 className="text-xl font-bold text-destructive">Couldn’t get live weather</h2>
            <p className="mt-1">{weatherErr}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={submit as any} className="btn-big bg-secondary text-secondary-foreground">Try again</button>
              <button onClick={useDemo} className="btn-big border-2 bg-card">Continue with demonstration data</button>
            </div>
          </div>
        )}

        {result && <Results r={result} />}
      </div>
    </main>
  );
}

function Results({ r }: { r: { w: WeatherData; a: Assessment; plan: Action[]; checks: Check[]; input: WorkerInput } }) {
  const { w, a, plan, checks, input } = r;
  const hi = input.lang === "hi";
  const lvlColor = ["bg-heat-0", "bg-heat-1", "bg-heat-2", "bg-heat-3", "bg-heat-4"][a.level];
  return (
    <section className="mt-8 space-y-6">
      {input.symptoms.trim() && (
        <div role="alert" className="rounded-2xl bg-destructive p-6 text-destructive-foreground">
          <h2 className="text-2xl font-bold">You reported symptoms</h2>
          <p className="mt-1 text-lg">Stop work, rest in shade, drink water and cool your body. If symptoms are severe or worsening, call 108 / 112 immediately.</p>
        </div>
      )}
      {w.source === "demo" && (
        <div className="rounded-xl border-2 border-warning bg-warning/15 p-4 font-semibold">DEMONSTRATION DATA — these are sample values, not real weather for {w.city}. Do not rely on this plan.</div>
      )}

      <div className="rounded-2xl border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-bold">{hi ? "मौसम" : "Weather"} — {w.city}{w.region && w.source === "live" ? `, ${w.region}` : ""}</h2>
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${w.source === "live" ? "bg-success text-primary-foreground" : "bg-warning"}`}>{w.source === "live" ? "LIVE" : "DEMO"}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat k="Now" v={`${w.temperature}°C`} />
          <Stat k="Feels like" v={`${w.apparent}°C`} />
          <Stat k="Today’s max" v={`${w.maxToday}°C`} />
          <Stat k="Humidity" v={`${w.humidity}%`} />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Forecast time: {w.time} ({w.timezone}). {w.source === "live" ? <>Source: <a className="underline" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo.com</a> (CC BY 4.0).</> : "Source: built-in sample."}
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-6">
        <h2 className="text-2xl font-bold">{hi ? "सावधानी स्तर" : "Heat guidance level"}</h2>
        <div className="mt-3 flex items-center gap-3">
          <span className={`h-5 w-5 rounded-full ${lvlColor}`} />
          <span className="text-2xl font-extrabold">{LEVELS[a.level][input.lang]}</span>
        </div>
        <ul className="mt-2 list-disc pl-6 text-muted-foreground">{a.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
        <p className="mt-3 text-sm text-muted-foreground">General guidance using heat-index bands. This is not a medically validated risk score.</p>
      </div>

      <div className="rounded-2xl border bg-card p-6">
        <h2 className="text-2xl font-bold">{hi ? "आज की कार्य सूची" : "Your checklist for today"}</h2>
        <ul className="mt-4 space-y-3">
          {plan.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer gap-3 rounded-xl bg-muted p-4 text-lg">
                <input type="checkbox" className="mt-1 h-6 w-6 accent-primary" />
                <span>{p[input.lang]}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6">
          <h2 className="text-xl font-bold">Verification</h2>
          <ul className="mt-3 space-y-2">
            {checks.map((c) => (
              <li key={c.label} className="flex gap-2">
                {c.pass ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />}
                <span><strong>{c.label}</strong> — <span className="text-muted-foreground">{c.detail}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border bg-card p-6">
          <h2 className="text-xl font-bold">Sources</h2>
          <ul className="mt-3 space-y-2">
            {[
              ["NDMA — Heat Wave guidelines (India)", "https://ndma.gov.in/Natural-Hazards/Heat-Wave"],
              ["US NWS — Heat Index categories", "https://www.weather.gov/safety/heat-index"],
              ["Open-Meteo weather API", "https://open-meteo.com/"],
            ].map(([t, u]) => (
              <li key={u}><a href={u} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">{t} <ExternalLink className="h-4 w-4" /></a></li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Field({ label, error, children }: { label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block font-semibold">{label}</label>
      {children}
      {error && <p className="mt-1 text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={`btn-big flex-1 border-2 ${active ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>{children}</button>
  );
}

function YesNo({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string | undefined }) {
  return (
    <Field label={label} error={error}>
      <div className="flex gap-3">
        <Choice active={value === "yes"} onClick={() => onChange("yes")}>Yes</Choice>
        <Choice active={value === "no"} onClick={() => onChange("no")}>No</Choice>
      </div>
    </Field>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return <div className="rounded-xl bg-muted p-4"><div className="text-sm text-muted-foreground">{k}</div><div className="text-3xl font-extrabold">{v}</div></div>;
}

function AgentRow({ name, s }: { name: string; s: AgentState }) {
  const icon = {
    idle: <Circle className="h-5 w-5 text-muted-foreground" />,
    running: <Loader2 className="h-5 w-5 animate-spin text-primary" />,
    done: <CheckCircle2 className="h-5 w-5 text-success" />,
    failed: <XCircle className="h-5 w-5 text-destructive" />,
    skipped: <Circle className="h-5 w-5 text-muted-foreground" />,
  }[s.status];
  const label = { idle: "Waiting", running: "Running", done: "Completed", failed: "Failed", skipped: "Not run" }[s.status];
  return (
    <li className="flex gap-3">
      {icon}
      <div>
        <div className="font-semibold">{name} <span className="text-sm font-normal text-muted-foreground">· {label}</span></div>
        {s.output && <p className="text-sm text-muted-foreground">{s.output}</p>}
      </div>
    </li>
  );
}
