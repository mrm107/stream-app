import { useEffect, useState } from "react";
import { streamShareLink } from "../eitaa";
import { ShareIcon } from "./Icons";
import { CheckIcon } from "./player/icons";
import { useI18n } from "../i18n";

// ShareButton hands out a link to this channel's stream. Where the phone has a
// share sheet it opens that; otherwise the link is copied. With the Eitaa
// mini-app's link configured, tapping the shared link in Eitaa opens the
// mini-app right at this stream.
export default function ShareButton({
  channelId,
  title,
  compact,
}: {
  channelId: number;
  title?: string;
  /** Icon only (the label stays for screen readers). */
  compact?: boolean;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const share = async () => {
    const url = streamShareLink(channelId);
    if (navigator.share) {
      try {
        await navigator.share({ url, title });
        return;
      } catch (err) {
        // The user closed the sheet: nothing more to do.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    if (await copy(url)) setCopied(true);
    else window.prompt(t("watch.copyLink"), url);
  };

  return (
    <button
      type="button"
      className={`btn btn--secondary btn--sm${compact ? " btn--icon-only" : ""}`}
      onClick={() => void share()}
      aria-label={copied ? t("watch.linkCopied") : t("watch.share")}
      title={copied ? t("watch.linkCopied") : t("watch.share")}
    >
      {/* A tick for two seconds once the link is on the clipboard. */}
      {copied ? <CheckIcon size={18} className="share-done" /> : <ShareIcon size={16} />}
      {!compact && <span>{copied ? t("watch.linkCopied") : t("watch.share")}</span>}
    </button>
  );
}

// copy puts text on the clipboard. WebViews often lack the async Clipboard
// API, so the old selection-based copy is the fallback.
async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }
}
