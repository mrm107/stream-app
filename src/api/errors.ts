import { ApiRequestError } from "./client";
import type { MessageKey } from "../i18n";

// Error codes with wording of our own in both languages. Any other code shows
// the server's message as it came.
const CODES: Record<string, MessageKey> = {
  image_invalid: "errors.imageInvalid",
  image_too_large: "errors.imageTooLarge",
  storage_unavailable: "errors.storageUnavailable",
  bio_too_long: "errors.bioTooLong",
  cannot_follow_self: "errors.cannotFollowSelf",
  channel_not_found: "errors.channelNotFound",
};

/** The text to show for a failed request. */
export function errorText(err: unknown, t: (key: MessageKey) => string): string {
  if (err instanceof ApiRequestError) {
    const key = CODES[err.code];
    return key ? t(key) : err.message;
  }
  return t("common.networkError");
}
