import type { Msg } from "..";

// The browse page: the grid of live channels and search results. {accent},
// {q} and {link} are filled with styled elements (see i18n/rich.tsx).
const fa = {
  heading: "{accent}‌ای که شاید بپسندید",
  headingAccent: "کانال‌های زنده",
  resultsFor: "نتایج جستجوی {q}",
  noMatch: "هیچ کانال زنده‌ای با جستجوی شما پیدا نشد",
  tryAnother: "نام یا عنوان دیگری را امتحان کنید.",
  noneLive: "الان کسی پخش زنده ندارد",
  beFirst: "اولین نفر باشید: {link} و پخش زنده را شروع کنید.",
  openStudio: "استودیو را باز کنید",
  watch: "تماشای {name}",
} satisfies Record<string, Msg>;

const en: { [K in keyof typeof fa]: Msg } = {
  heading: "{accent} we think you’ll like",
  headingAccent: "Live channels",
  resultsFor: "Results for {q}",
  noMatch: "No live channels match your search",
  tryAnother: "Try another name or title.",
  noneLive: "No one is live right now",
  beFirst: "Be the first — {link} and go live.",
  openStudio: "open the Creator Dashboard",
  watch: "Watch {name}",
};

export default { fa, en };
