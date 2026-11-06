import type { Msg } from "..";

// Top nav, user menu and the live-channels rail. en must have every key fa has.
const fa = {
  home: "صفحه‌ی اصلی",
  browse: "مرور",
  search: "جستجو",
  searchLabel: "جستجوی کانال‌های زنده",
  login: "ورود",
  signup: "ثبت‌نام",
  userMenu: "منوی حساب",
  studio: "استودیو",
  streamKey: "کلید پخش",
  logout: "خروج",
  language: "زبان",
  liveChannels: "کانال‌های زنده",
  expand: "باز کردن",
  collapse: "بستن",
  expandSidebar: "باز کردن نوار کناری",
  collapseSidebar: "بستن نوار کناری",
  noneLive: "الان کسی پخش زنده ندارد.",
} satisfies Record<string, Msg>;

const en: { [K in keyof typeof fa]: Msg } = {
  home: "Home",
  browse: "Browse",
  search: "Search",
  searchLabel: "Search live channels",
  login: "Log In",
  signup: "Sign Up",
  userMenu: "Account menu",
  studio: "Creator Dashboard",
  streamKey: "Stream Key",
  logout: "Log Out",
  language: "Language",
  liveChannels: "Live Channels",
  expand: "Expand",
  collapse: "Collapse",
  expandSidebar: "Expand sidebar",
  collapseSidebar: "Collapse sidebar",
  noneLive: "No one is live right now.",
};

export default { fa, en };
