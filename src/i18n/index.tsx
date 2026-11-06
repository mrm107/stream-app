// Two-language UI: Persian (the default, right-to-left) and English. Strings
// live per area in messages/*.ts as { fa, en } pairs; en must have every key
// fa has, so a missing translation is a type error. Numbers and dates go
// through Intl in the current language (Persian digits in fa).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { namespaces } from "./messages";

export type Lang = "fa" | "en";
export const LANGS: Lang[] = ["fa", "en"];

type Params = Record<string, string | number>;
/** A message is text with {name} placeholders, or a function for plurals. */
export type Msg = string | ((p: Params) => string);

type NS = typeof namespaces;
export type MessageKey = {
  [N in keyof NS]: `${N & string}.${keyof NS[N]["fa"] & string}`;
}[keyof NS];

const STORAGE_KEY = "lang";

function stored(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "fa" || v === "en") return v;
  } catch {
    // storage unavailable
  }
  return "fa";
}

let current: Lang = stored();

/** The language right now, for code outside React (hooks, formatters). */
export function currentLang(): Lang {
  return current;
}

export const dirOf = (lang: Lang): "rtl" | "ltr" => (lang === "fa" ? "rtl" : "ltr");

function applyDocument(lang: Lang) {
  const el = document.documentElement;
  el.lang = lang;
  el.dir = dirOf(lang);
}

// Before the first render, so the page never flashes the other direction.
applyDocument(current);

/** t outside React. Numbers in params are formatted for the language. */
export function translate(lang: Lang, key: MessageKey, params: Params = {}): string {
  const dot = key.indexOf(".");
  const ns = namespaces[key.slice(0, dot) as keyof NS] as { fa: Record<string, Msg>; en: Record<string, Msg> };
  const msg = ns?.[lang]?.[key.slice(dot + 1)] ?? ns?.fa?.[key.slice(dot + 1)];
  if (msg === undefined) return key;
  if (typeof msg === "function") return msg(params);
  return msg.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = params[name];
    if (v === undefined) return `{${name}}`;
    return typeof v === "number" ? formatNumber(v, lang) : v;
  });
}

export function formatNumber(n: number, lang: Lang = current): string {
  return new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en-US").format(n);
}

/** 950, 1.2K, 12K, 1.3M — or ۱٫۲ هزار in Persian. */
export function formatCompact(n: number, lang: Lang = current): string {
  return new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en-US", {
    notation: "compact",
    maximumFractionDigits: n < 10_000 ? 1 : 0,
  }).format(n);
}

/** Latin digits in s become Persian ones in fa; e.g. for h:mm:ss. */
export function localDigits(s: string, lang: Lang = current): string {
  return lang === "fa" ? s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]) : s;
}

interface I18n {
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (lang: Lang) => void;
  t: (key: MessageKey, params?: Params) => string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(current);

  useEffect(() => {
    current = lang;
    applyDocument(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // the choice just won't persist
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    current = l;
    setLangState(l);
  }, []);
  const t = useCallback((key: MessageKey, params?: Params) => translate(lang, key, params), [lang]);
  const value = useMemo(() => ({ lang, dir: dirOf(lang), setLang, t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n outside I18nProvider");
  return v;
}
