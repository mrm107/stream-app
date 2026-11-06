import type { Msg } from "..";

// The profile panel in the studio: picture, banner, display name, bio.
const fa = {
  title: "پروفایل",
  avatar: "عکس پروفایل",
  changePhoto: "تغییر عکس",
  remove: "حذف",
  banner: "بنر کانال",
  changeBanner: "تغییر بنر",
  noBanner: "بنری انتخاب نکرده‌اید",
  bannerHint: "وقتی آفلاین هستید، پشت پخش‌کننده‌ی کانالتان دیده می‌شود. اندازه‌ی پیشنهادی: ۱۲۰۰ در ۴۸۰ پیکسل.",
  bannerNeedsChannel: "برای گذاشتن بنر، اول کانالتان را بسازید.",
  imageRules: "JPEG، PNG، WebP یا GIF، حداکثر ۸ مگابایت.",
  uploading: "در حال بارگذاری… {p}٪",
  removing: "در حال حذف…",
  badType: "فقط عکس‌های JPEG، PNG، WebP یا GIF را می‌شود بارگذاری کرد.",
  tooBig: "حجم عکس نباید بیشتر از ۸ مگابایت باشد.",
  displayName: "نام نمایشی",
  bio: "درباره‌ی شما",
  bioPlaceholder: "چند خط درباره‌ی خودتان و پخش‌هایتان بنویسید",
  bioCount: "{n}/{max}",
  save: "ذخیره",
  saving: "در حال ذخیره…",
  saved: "ذخیره شد!",
} satisfies Record<string, Msg>;

const en: { [K in keyof typeof fa]: Msg } = {
  title: "Profile",
  avatar: "Profile picture",
  changePhoto: "Change photo",
  remove: "Remove",
  banner: "Channel banner",
  changeBanner: "Change banner",
  noBanner: "No banner yet",
  bannerHint: "Shown behind your channel's player while you're offline. Recommended size: 1200 × 480.",
  bannerNeedsChannel: "Create your channel first to add a banner.",
  imageRules: "JPEG, PNG, WebP or GIF, up to 8 MB.",
  uploading: "Uploading… {p}%",
  removing: "Removing…",
  badType: "Only JPEG, PNG, WebP or GIF images can be uploaded.",
  tooBig: "The image must be 8 MB or smaller.",
  displayName: "Display name",
  bio: "Bio",
  bioPlaceholder: "A few lines about you and your streams",
  bioCount: "{n}/{max}",
  save: "Save",
  saving: "Saving…",
  saved: "Saved!",
};

export default { fa, en };
