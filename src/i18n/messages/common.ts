import type { Msg } from "..";

// Shared strings: language names, counts, generic errors.
const fa = {
  langName: "فارسی",
  switchLang: "English",
  networkError: "خطای شبکه؛ دوباره امتحان کنید",
  viewers: "{n} بیننده",
  live: "زنده",
  offline: "آفلاین",
  close: "بستن",
  cancel: "انصراف",
} satisfies Record<string, Msg>;

const en: { [K in keyof typeof fa]: Msg } = {
  langName: "English",
  switchLang: "فارسی",
  networkError: "Network error; try again",
  viewers: (p) => `${p.n} ${p.count === 1 ? "viewer" : "viewers"}`,
  live: "LIVE",
  offline: "OFFLINE",
  close: "Close",
  cancel: "Cancel",
};

export default { fa, en };
