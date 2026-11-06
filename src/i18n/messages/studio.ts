import type { Msg } from "..";

// The creator studio: channel creation, stream status/title, OBS setup.
// {custom} and {path} are filled with styled elements (see i18n/rich.tsx).
// en must have every key fa has.
const fa = {
  loading: "در حال بارگذاری…",
  title: "استودیو",
  signedInAs: "وارد شده با {name}",
  startTitle: "شروع پخش",
  noChannel: "هنوز کانالی ندارید. یک کانال بسازید تا کلید پخش بگیرید و پخش زنده را شروع کنید.",
  creating: "در حال ساخت…",
  create: "ساخت کانال",
  status: "وضعیت پخش",
  watchingSince: "{n} بیننده · از ساعت {time}",
  watchYours: "تماشای پخش خودتان ←",
  offline:
    "آفلاین هستید. در OBS دکمه‌ی «Start Streaming» را بزنید تا پخش زنده شروع شود؛ با توقف OBS پخش تمام می‌شود.",
  streamTitle: "عنوان پخش",
  titlePlaceholder: "امروز چه چیزی پخش می‌کنید؟",
  save: "ذخیره",
  saved: "ذخیره شد!",
  titleHint:
    "عنوان را قبل از شروع پخش تنظیم کنید. اگر وسط پخش عوضش کنید، عنوان پخش فعلی هم عوض می‌شود.",
  setup: "تنظیمات پخش",
  setupHelp: "در {path} گزینه‌ی {custom} را انتخاب کنید و این مقادیر را در آن وارد کنید.",
  server: "سرور",
  streamKey: "کلید پخش",
  keyUnavailable:
    "کلید این کانال پیش از آن ساخته شده که نمایش دوباره‌ی کلید ممکن شود. برای دیدنش در اینجا، کلید جدیدی بسازید.",
  loadingKey: "در حال بارگذاری کلید پخش…",
  generateKey: "ساخت کلید پخش",
  resetKey: "تعویض کلید پخش",
  keyPrivate:
    "کلید را به کسی ندهید: هر کس آن را داشته باشد می‌تواند روی کانال شما پخش کند. کلید داخل آدرس RTMP است و هیچ‌وقت در لینک عمومی پخش دیده نمی‌شود. اگر لو رفت، عوضش کنید.",
  confirmReset:
    "کلید پخش جدید ساخته شود؟ تا کلید جدید را در OBS وارد نکنید، پخش از OBS کار نمی‌کند.",
  show: "نمایش",
  hide: "پنهان",
  copy: "کپی",
  copied: "کپی شد!",
} satisfies Record<string, Msg>;

const en: { [K in keyof typeof fa]: Msg } = {
  loading: "Loading…",
  title: "Creator Dashboard",
  signedInAs: "Signed in as {name}",
  startTitle: "Start broadcasting",
  noChannel: "You don't have a channel yet. Create one to get a stream key and go live.",
  creating: "Creating…",
  create: "Create my channel",
  status: "Stream status",
  watchingSince: "{n} watching · since {time}",
  watchYours: "Watch your stream →",
  offline: "Offline. Press “Start Streaming” in OBS to go live; stopping OBS ends the stream.",
  streamTitle: "Stream title",
  titlePlaceholder: "What are you streaming today?",
  save: "Save",
  saved: "Saved!",
  titleHint: "Set this before you go live. Changing it while live updates your current stream too.",
  setup: "Stream setup",
  setupHelp: "In {path}, pick {custom} and paste these.",
  server: "Server",
  streamKey: "Stream key",
  keyUnavailable:
    "This channel's key was created before keys could be shown again. Generate a new one to see it here.",
  loadingKey: "Loading stream key…",
  generateKey: "Generate stream key",
  resetKey: "Reset stream key",
  keyPrivate:
    "Keep the key private: anyone with it can stream on your channel. It travels inside the RTMP URL, so it never appears in the public playback link. If it leaks, reset it.",
  confirmReset: "Generate a new stream key? OBS will stop working until you paste the new one.",
  show: "Show",
  hide: "Hide",
  copy: "Copy",
  copied: "Copied!",
};

export default { fa, en };
