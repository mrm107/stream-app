// Player and chat icons, 24px grid, currentColor.

type P = { size?: number; className?: string };

function icon(d: React.ReactNode, { size = 24, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      {d}
    </svg>
  );
}

export const PlayIcon = (p: P) => icon(<path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.9-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" />, p);
export const PauseIcon = (p: P) => icon(<path d="M7 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm7 0h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />, p);
export const VolumeIcon = (p: P) =>
  icon(<path d="M4 9h3l5-4v14l-5-4H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1Zm12.5-1.9a6.5 6.5 0 0 1 0 9.8l-1.4-1.42a4.5 4.5 0 0 0 0-6.96l1.4-1.42Zm2.84-2.83a10.5 10.5 0 0 1 0 15.46l-1.42-1.41a8.5 8.5 0 0 0 0-12.64l1.42-1.41Z" />, p);
export const MutedIcon = (p: P) =>
  icon(<path d="M4 9h3l5-4v14l-5-4H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1Zm11.3.7 1.4-1.4 2.3 2.29 2.3-2.3 1.4 1.42L20.42 12l2.3 2.3-1.42 1.4L19 13.42l-2.3 2.3-1.4-1.42L17.58 12l-2.3-2.3Z" />, p);
export const GearIcon = (p: P) =>
  icon(<path fillRule="evenodd" d="M10.3 2h3.4l.5 2.6c.6.2 1.1.5 1.6.9l2.5-.9 1.7 2.9-2 1.8a7 7 0 0 1 0 1.8l2 1.8-1.7 2.9-2.5-.9c-.5.4-1 .7-1.6.9l-.5 2.6h-3.4l-.5-2.6a7 7 0 0 1-1.6-.9l-2.5.9-1.7-2.9 2-1.8a7 7 0 0 1 0-1.8l-2-1.8L5.7 4.6l2.5.9c.5-.4 1-.7 1.6-.9L10.3 2ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" transform="translate(0 2)" />, p);
export const FullscreenIcon = (p: P) => icon(<path d="M4 4h6v2H6v4H4V4Zm10 0h6v6h-2V6h-4V4ZM4 14h2v4h4v2H4v-6Zm14 0h2v6h-6v-2h4v-4Z" />, p);
export const ExitFullscreenIcon = (p: P) => icon(<path d="M8 4h2v6H4V8h4V4Zm6 0h2v4h4v2h-6V4ZM4 14h6v6H8v-4H4v-2Zm10 0h6v2h-4v4h-2v-6Z" />, p);
export const ChatIcon = (p: P) =>
  icon(<path d="M5 3h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6.6L7 21v-4H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm0 2v10h4v2.1l2.8-2.1H19V5H5Zm2 3h10v2H7V8Zm0 3h7v2H7v-2Z" />, p);
export const SendIcon = (p: P) => icon(<path d="M3.4 20.4 21 12 3.4 3.6 3 10l12 2-12 2 .4 6.4Z" />, p);
export const ArrowDownIcon = (p: P) => icon(<path d="M11 4h2v12.17l4.59-4.58L19 13l-7 7-7-7 1.41-1.41L11 16.17V4Z" />, p);
export const CheckIcon = (p: P) => icon(<path d="m9.5 16.2-4.2-4.2-1.4 1.4 5.6 5.6 11-11-1.4-1.4-9.6 9.6Z" />, p);
export const ToolsIcon = (p: P) =>
  icon(<path d="M3 5h11v2H3V5Zm14-1h2v1h2v2h-2v1h-2V4ZM3 11h4v2H3v-2Zm6-1h2v1h10v2H11v1H9v-4Zm-6 7h11v2H3v-2Zm14-1h2v1h2v2h-2v1h-2v-4Z" />, p);
