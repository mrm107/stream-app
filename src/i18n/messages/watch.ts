import type { Msg } from "..";

// The watch page around the player.
const fa = {
  untitled: "پخش بدون عنوان",
  followers: "{n} دنبال‌کننده",
  uptime: "مدت پخش",
  viewers: "بیننده",
  share: "اشتراک",
  linkCopied: "لینک کپی شد",
  copyLink: "این لینک را کپی کنید",
  follow: "دنبال کردن",
  following: "دنبال می‌کنید",
  unfollow: "لغو دنبال",
  about: "درباره‌ی {name}",
  channelInfo: "اطلاعات کانال",
} satisfies Record<string, Msg>;

const en: { [K in keyof typeof fa]: Msg } = {
  untitled: "Untitled stream",
  followers: (p) => `${p.n} ${p.count === 1 ? "follower" : "followers"}`,
  uptime: "Stream uptime",
  viewers: "Viewers",
  share: "Share",
  linkCopied: "Link copied",
  copyLink: "Copy this link",
  follow: "Follow",
  following: "Following",
  unfollow: "Unfollow",
  about: "About {name}",
  channelInfo: "Channel info",
};

export default { fa, en };
