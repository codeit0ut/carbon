export const linguiLocales = ["en", "es", "de", "fr"] as const;
export type LinguiLocale = (typeof linguiLocales)[number];

const ARIA_LOCALE: Record<LinguiLocale, string> = {
  en: "en-US",
  es: "es-ES",
  de: "de-DE",
  fr: "fr-FR"
};

export function isLinguiLocale(s: string): s is LinguiLocale {
  return (linguiLocales as readonly string[]).includes(s);
}

/** Map Accept-Language / BCP-47 base tag to a Lingui catalog key. */
export function toLinguiLocale(tag: string): LinguiLocale {
  const base = tag.split("-")[0]?.toLowerCase() ?? "en";
  if (base === "es") return "es";
  if (base === "de") return "de";
  if (base === "fr") return "fr";
  return "en";
}

export function ariaLocaleForLingui(lingui: LinguiLocale): string {
  return ARIA_LOCALE[lingui];
}
