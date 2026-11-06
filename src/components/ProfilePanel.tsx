import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { OnProgress } from "../api/client";
import { errorText } from "../api/errors";
import { useAuth } from "../auth/AuthContext";
import { useI18n } from "../i18n";
import type { MessageKey } from "../i18n";
import Avatar from "./Avatar";
import type { Channel } from "../api/types";

// What the server takes (it checks again, and the pixel size too).
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 8 * 1024 * 1024;
export const BIO_MAX = 300;

// Characters as the server counts them (code points, not UTF-16 units).
const length = (s: string) => [...s].length;
const clip = (s: string, max: number) => (length(s) > max ? [...s].slice(0, max).join("") : s);

function checkImage(file: File): MessageKey | null {
  if (!IMAGE_TYPES.includes(file.type)) return "profile.badType";
  if (file.size > MAX_BYTES) return "profile.tooBig";
  return null;
}

type Kind = "avatar" | "banner";
// One picture change in flight: an upload (with progress, 0..1, and a local
// preview of the picked file) or a removal.
type Pending = { kind: Kind; op: "upload"; progress: number; preview: string } | { kind: Kind; op: "remove" };

interface Props {
  // The caller's channel, for the banner; null before they create one.
  channel: Channel | null;
  onChannel: (ch: Channel) => void;
}

// ProfilePanel edits what viewers see of the account: the picture, the
// channel banner, the display name and the bio. Pictures upload as soon as
// they're picked; name and bio wait for Save.
export default function ProfilePanel({ channel, onChannel }: Props) {
  const { session, updateUser } = useAuth();
  const { t } = useI18n();
  const user = session?.user;

  const [pending, setPending] = useState<Pending | null>(null);
  const [imageError, setImageError] = useState("");

  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState("");

  // The form starts from the session's user, which is refreshed from the
  // server shortly after load; follow it until the user starts typing.
  const touched = useRef(false);
  useEffect(() => {
    if (touched.current || !user) return;
    setDisplayName(user.display_name ?? "");
    setBio(user.bio ?? "");
  }, [user?.display_name, user?.bio]);

  // A local preview's object URL is released once the upload is over.
  const preview = pending?.op === "upload" ? pending.preview : null;
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  if (!user) return null;
  const name = user.display_name || user.username;

  async function upload(kind: Kind, file: File) {
    setImageError("");
    const bad = checkImage(file);
    if (bad) {
      setImageError(t(bad));
      return;
    }
    const onProgress: OnProgress = (progress) =>
      setPending((p) => (p?.op === "upload" ? { ...p, progress } : p));
    setPending({ kind, op: "upload", progress: 0, preview: URL.createObjectURL(file) });
    try {
      if (kind === "avatar") updateUser(await api.users.uploadAvatar(file, onProgress));
      else onChannel(await api.channels.uploadBanner(file, onProgress));
    } catch (err) {
      setImageError(errorText(err, t));
    } finally {
      setPending(null);
    }
  }

  async function remove(kind: Kind) {
    setImageError("");
    setPending({ kind, op: "remove" });
    try {
      if (kind === "avatar") updateUser(await api.users.deleteAvatar());
      else onChannel(await api.channels.deleteBanner());
    } catch (err) {
      setImageError(errorText(err, t));
    } finally {
      setPending(null);
    }
  }

  const savedName = user.display_name ?? "";
  const savedBio = user.bio ?? "";
  const changed = displayName.trim() !== savedName || bio !== savedBio;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (length(bio) > BIO_MAX) {
      setFormError(t("errors.bioTooLong"));
      return;
    }
    // Only what changed: a field left out keeps its value.
    const change: { display_name?: string; bio?: string } = {};
    if (displayName.trim() !== savedName) change.display_name = displayName.trim();
    if (bio !== savedBio) change.bio = bio;
    setSaving(true);
    try {
      const next = await api.users.updateMe(change);
      updateUser(next);
      touched.current = false;
      setDisplayName(next.display_name ?? "");
      setBio(next.bio ?? "");
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setFormError(errorText(err, t));
    } finally {
      setSaving(false);
    }
  }

  const status = (kind: Kind) => {
    if (pending?.kind !== kind) return null;
    if (pending.op === "remove") return <span className="muted small">{t("profile.removing")}</span>;
    const pct = Math.round(pending.progress * 100);
    return (
      <span className="upload-status">
        <span className="upload-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <span style={{ inlineSize: `${pct}%` }} />
        </span>
        <span className="muted small">{t("profile.uploading", { p: pct })}</span>
      </span>
    );
  };
  const previewOf = (kind: Kind) => (pending?.kind === kind && pending.op === "upload" ? pending.preview : null);
  const busy = pending !== null;
  const avatarSrc = previewOf("avatar") ?? user.avatar_url;
  const bannerSrc = previewOf("banner") ?? channel?.banner_url ?? null;

  return (
    <section className="panel profile-panel">
      <h2 className="panel-title">{t("profile.title")}</h2>

      <div className="profile-images">
        <div className="profile-field">
          <span className="copy-label">{t("profile.avatar")}</span>
          <div className="profile-avatar-row">
            <span className={pending?.kind === "avatar" ? "profile-pending" : undefined}>
              <Avatar name={name} src={avatarSrc} size={72} />
            </span>
            <div className="profile-actions">
              <div className="row">
                <FilePick disabled={busy} onPick={(f) => void upload("avatar", f)}>
                  {t("profile.changePhoto")}
                </FilePick>
                {user.avatar_url && (
                  <button type="button" className="btn btn--secondary btn--sm" disabled={busy} onClick={() => void remove("avatar")}>
                    {t("profile.remove")}
                  </button>
                )}
              </div>
              {status("avatar") ?? <span className="muted small">{t("profile.imageRules")}</span>}
            </div>
          </div>
        </div>

        <div className="profile-field">
          <span className="copy-label">{t("profile.banner")}</span>
          {channel ? (
            <>
              <div
                className={`profile-banner${pending?.kind === "banner" ? " profile-pending" : ""}`}
                style={bannerSrc ? { backgroundImage: `url("${bannerSrc.replace(/["\\\n]/g, (c) => encodeURIComponent(c))}")` } : undefined}
              >
                {!bannerSrc && <span className="muted small">{t("profile.noBanner")}</span>}
              </div>
              <div className="row">
                <FilePick disabled={busy} onPick={(f) => void upload("banner", f)}>
                  {t("profile.changeBanner")}
                </FilePick>
                {channel.banner_url && (
                  <button type="button" className="btn btn--secondary btn--sm" disabled={busy} onClick={() => void remove("banner")}>
                    {t("profile.remove")}
                  </button>
                )}
                {status("banner")}
              </div>
              <p className="muted small">{t("profile.bannerHint")}</p>
            </>
          ) : (
            <p className="muted small">{t("profile.bannerNeedsChannel")}</p>
          )}
        </div>
        {imageError && <p className="error">{imageError}</p>}
      </div>

      <form className="profile-form" onSubmit={save}>
        <label className="field">
          <span>{t("profile.displayName")}</span>
          <input
            dir="auto"
            value={displayName}
            placeholder={user.username}
            maxLength={64}
            onChange={(e) => {
              touched.current = true;
              setDisplayName(e.target.value);
            }}
          />
        </label>
        <label className="field">
          <span className="field-head">
            {t("profile.bio")}
            <small className={length(bio) >= BIO_MAX ? "accent" : "muted"}>
              {t("profile.bioCount", { n: length(bio), max: BIO_MAX })}
            </small>
          </span>
          <textarea
            dir="auto"
            rows={4}
            value={bio}
            placeholder={t("profile.bioPlaceholder")}
            onChange={(e) => {
              touched.current = true;
              setBio(clip(e.target.value, BIO_MAX));
            }}
          />
        </label>
        {formError && <p className="error">{formError}</p>}
        <div className="row">
          <button type="submit" className="btn btn--primary" disabled={saving || !changed}>
            {saving ? t("profile.saving") : saved ? t("profile.saved") : t("profile.save")}
          </button>
        </div>
      </form>
    </section>
  );
}

// FilePick is a button that opens the file chooser for one image.
function FilePick({ disabled, onPick, children }: { disabled: boolean; onPick: (f: File) => void; children: React.ReactNode }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="btn btn--secondary btn--sm" disabled={disabled} onClick={() => ref.current?.click()}>
        {children}
      </button>
      <input
        ref={ref}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Cleared, so picking the same file again still fires a change.
          e.target.value = "";
          if (file) onPick(file);
        }}
      />
    </>
  );
}
