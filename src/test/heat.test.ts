import { describe, expect, it } from "vitest";
import { baseLevel, assess } from "@/lib/heat";

const w = { city: "X", region: "", latitude: 0, longitude: 0, temperature: 38, apparent: 42, humidity: 30, maxToday: 40, maxApparentToday: 42, time: "2026-01-01T12:00", timezone: "Asia/Kolkata", source: "live" as const };
const i = { city: "X", work: "Construction", hours: 4, shade: true, water: true, lang: "en" as const, symptoms: "" };

describe("heat guidance", () => {
  it("41°C feels-like is Danger band", () => expect(baseLevel(41)).toBe(3));
  it("no shade raises level by one", () => expect(assess(w, { ...i, shade: false }).level).toBe(4));
});
