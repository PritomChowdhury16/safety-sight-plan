import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { WeatherData } from "./heat";

// Server-side Open-Meteo integration (no API key required). Future Gemini calls belong here too.
export const fetchWeather = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ city: z.string().trim().min(2).max(80) }).parse(d))
  .handler(async ({ data }): Promise<{ ok: boolean; weather?: WeatherData; error?: string }> => {
    try {
      const g = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(data.city)}&count=1&countryCode=IN&language=en&format=json`,
      );
      if (!g.ok) return { ok: false, error: `Geocoding service returned ${g.status}` };
      const gj = (await g.json()) as { results?: { name: string; admin1?: string; latitude: number; longitude: number }[] };
      const place = gj.results?.[0];
      if (!place) return { ok: false, error: `Could not find "${data.city}" in India. Check the spelling.` };
      const f = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m&daily=temperature_2m_max,apparent_temperature_max&timezone=auto&forecast_days=1`,
      );
      if (!f.ok) return { ok: false, error: `Weather service returned ${f.status}` };
      const fj = (await f.json()) as any;
      return {
        ok: true,
        weather: {
          city: place.name,
          region: place.admin1 ?? "",
          latitude: place.latitude,
          longitude: place.longitude,
          temperature: fj.current.temperature_2m,
          apparent: fj.current.apparent_temperature,
          humidity: fj.current.relative_humidity_2m,
          maxToday: fj.daily.temperature_2m_max[0],
          maxApparentToday: fj.daily.apparent_temperature_max[0],
          time: fj.current.time,
          timezone: fj.timezone,
          source: "live",
        },
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Network error contacting Open-Meteo" };
    }
  });
