import type { Msg } from "..";

// Server error codes shown in our own words (see api/errors.ts).
const fa = {
  imageInvalid: "این فایل عکس معتبری نیست یا ابعادش بیش از حد بزرگ است.",
  imageTooLarge: "حجم عکس نباید بیشتر از ۸ مگابایت باشد.",
  storageUnavailable: "بارگذاری عکس فعلاً ممکن نیست؛ کمی بعد دوباره امتحان کنید.",
  bioTooLong: "متن «درباره» حداکثر ۳۰۰ نویسه می‌تواند باشد.",
  cannotFollowSelf: "نمی‌توانید کانال خودتان را دنبال کنید.",
  channelNotFound: "این کانال پیدا نشد.",
} satisfies Record<string, Msg>;

const en: { [K in keyof typeof fa]: Msg } = {
  imageInvalid: "That file isn't a valid image, or its dimensions are too large.",
  imageTooLarge: "The image must be 8 MB or smaller.",
  storageUnavailable: "Uploads aren't available right now; try again later.",
  bioTooLong: "The bio can be at most 300 characters.",
  cannotFollowSelf: "You can't follow your own channel.",
  channelNotFound: "Channel not found.",
};

export default { fa, en };
