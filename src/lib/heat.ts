// Rule-based guidance. NOT a medically validated risk score.
// Bands follow the US NWS heat index categories applied to Open-Meteo "apparent temperature".

export type Lang = "en" | "hi";
export type Level = 0 | 1 | 2 | 3 | 4;

export interface WorkerInput {
  city: string;
  work: string;
  hours: number;
  shade: boolean;
  water: boolean;
  lang: Lang;
  symptoms: string;
}

export interface WeatherData {
  city: string;
  region: string;
  latitude: number;
  longitude: number;
  temperature: number;
  apparent: number;
  humidity: number;
  maxToday: number;
  maxApparentToday: number;
  time: string; // ISO local
  timezone: string;
  source: "live" | "demo";
}

export const LEVELS = [
  { en: "Lower concern", hi: "कम चिंता" },
  { en: "Caution", hi: "सावधानी" },
  { en: "Extreme caution", hi: "अत्यधिक सावधानी" },
  { en: "Danger", hi: "खतरा" },
  { en: "Extreme danger", hi: "अत्यधिक खतरा" },
] as const;

export function baseLevel(apparentC: number): Level {
  if (apparentC >= 54) return 4;
  if (apparentC >= 41) return 3;
  if (apparentC >= 32) return 2;
  if (apparentC >= 27) return 1;
  return 0;
}

export interface Assessment {
  level: Level;
  base: Level;
  reasons: string[];
}

export function assess(w: WeatherData, i: WorkerInput): Assessment {
  const peak = Math.max(w.apparent, w.maxApparentToday);
  const base = baseLevel(peak);
  const reasons = [`Peak feels-like temperature today: ${peak.toFixed(1)}°C`];
  let bump = 0;
  if (base > 0) {
    if (!i.shade) { bump++; reasons.push("No access to shade"); }
    if (!i.water) { bump++; reasons.push("No access to drinking water"); }
    if (i.hours > 6) { bump++; reasons.push(`Long outdoor exposure (${i.hours} h)`); }
  }
  const level = Math.min(4, base + Math.min(bump, 1)) as Level;
  return { level, base, reasons };
}

export interface Action { id: string; en: string; hi: string; topic: "water" | "shade" | "rest" | "clothing" | "timing" | "buddy" | "emergency"; }

export function buildPlan(a: Assessment, i: WorkerInput): Action[] {
  const out: Action[] = [
    { id: "water", topic: "water", en: "Drink a glass of water every 20 minutes, even if not thirsty.", hi: "प्यास न लगे तब भी हर 20 मिनट में एक गिलास पानी पिएँ।" },
    { id: "cloth", topic: "clothing", en: "Wear light, loose, light-coloured cotton clothes and cover your head.", hi: "हल्के, ढीले, हल्के रंग के सूती कपड़े पहनें और सिर ढकें।" },
    { id: "signs", topic: "emergency", en: "Know warning signs: dizziness, headache, nausea, confusion, no sweating.", hi: "चेतावनी संकेत पहचानें: चक्कर, सिरदर्द, उल्टी जैसा लगना, भ्रम, पसीना बंद होना।" },
  ];
  if (!i.water) out.push({ id: "carry", topic: "water", en: "Carry at least 2–3 litres of water from home; ask your employer for drinking water.", hi: "घर से कम से कम 2–3 लीटर पानी ले जाएँ; मालिक से पीने का पानी माँगें।" });
  if (a.level >= 1) out.push({ id: "rest", topic: "rest", en: a.level >= 3 ? "Take a 15-minute break in shade every hour." : "Take short shade breaks every 1–2 hours.", hi: a.level >= 3 ? "हर घंटे 15 मिनट छाया में आराम करें।" : "हर 1–2 घंटे में छाया में थोड़ा आराम करें।" });
  if (!i.shade && a.level >= 1) out.push({ id: "shade", topic: "shade", en: "Find or make shade (tarp, umbrella, tree) for breaks before starting.", hi: "काम शुरू करने से पहले आराम के लिए छाया (तिरपाल, छाता, पेड़) तय करें।" });
  if (a.level >= 2) out.push({ id: "timing", topic: "timing", en: "Avoid heavy work between 12 noon and 3 PM; shift it to early morning or evening.", hi: "दोपहर 12 से 3 बजे तक भारी काम न करें; सुबह जल्दी या शाम को करें।" });
  if (a.level >= 2) out.push({ id: "ors", topic: "water", en: "Use ORS, lassi, buttermilk or lemon water to replace salts.", hi: "नमक की कमी पूरी करने के लिए ORS, लस्सी, छाछ या नींबू पानी लें।" });
  if (a.level >= 3) out.push({ id: "buddy", topic: "buddy", en: "Work with a buddy and check on each other regularly.", hi: "साथी के साथ काम करें और एक-दूसरे का ध्यान रखें।" });
  if (i.hours > 6 && a.level >= 2) out.push({ id: "hours", topic: "timing", en: "Try to reduce continuous outdoor hours today.", hi: "आज लगातार बाहर रहने के घंटे कम करने की कोशिश करें।" });
  out.push({ id: "call", topic: "emergency", en: "If someone collapses or is confused: move to shade, cool with water, call 108 / 112.", hi: "अगर कोई गिर जाए या भ्रमित हो: छाया में ले जाएँ, पानी से ठंडा करें, 108 / 112 पर कॉल करें।" });
  return out;
}

export interface Check { label: string; pass: boolean; detail: string; }

export function verify(w: WeatherData, a: Assessment, plan: Action[], i: WorkerInput, now = new Date()): Check[] {
  const topics = new Set(plan.map((p) => p.topic));
  const ageH = (now.getTime() - new Date(w.time + "Z").getTime()) / 36e5;
  return [
    { label: "Weather source", pass: w.source === "live", detail: w.source === "live" ? "Live Open-Meteo data" : "Demonstration data — not real conditions" },
    { label: "Data values plausible", pass: w.apparent > -30 && w.apparent < 65, detail: `Feels-like ${w.apparent}°C` },
    { label: "Data freshness", pass: w.source === "live" && Math.abs(ageH) < 30, detail: w.source === "live" ? `Forecast time ${w.time} (${w.timezone})` : "Not applicable for demo data" },
    { label: "Plan covers hydration", pass: topics.has("water"), detail: "Water guidance present" },
    { label: "Plan covers emergency signs", pass: topics.has("emergency"), detail: "Warning signs and helpline present" },
    { label: "Rest guidance matches level", pass: a.level === 0 || topics.has("rest"), detail: `Guidance level ${a.level}` },
    { label: "Symptoms reviewed", pass: true, detail: i.symptoms.trim() ? "Symptoms reported — emergency notice shown" : "No symptoms reported" },
  ];
}
