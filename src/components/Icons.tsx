// Inline SVG icons, drawn on a 20px grid like Twitch's. currentColor, so they
// take the text color of wherever they sit.

type IconProps = { size?: number; className?: string };

function svg(path: React.ReactNode, { size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      {path}
    </svg>
  );
}

export const SearchIcon = (p: IconProps) =>
  svg(<path fillRule="evenodd" d="M13.192 14.606a7 7 0 1 1 1.414-1.414l3.101 3.1-1.414 1.415-3.1-3.1ZM14 9A5 5 0 1 1 4 9a5 5 0 0 1 10 0Z" clipRule="evenodd" />, p);

export const PersonIcon = (p: IconProps) =>
  svg(<path fillRule="evenodd" d="M5 7a5 5 0 1 1 6.192 4.857A2 2 0 0 0 13 13h1a3 3 0 0 1 3 3v2h-2v-2a1 1 0 0 0-1-1h-1a3.99 3.99 0 0 1-3-1.354A3.99 3.99 0 0 1 7 15H6a1 1 0 0 0-1 1v2H3v-2a3 3 0 0 1 3-3h1a2 2 0 0 0 1.808-1.143A5.002 5.002 0 0 1 5 7Zm5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />, p);

export const CollapseIcon = (p: IconProps) =>
  svg(<path d="M16 16V4h2v12h-2ZM6 9l2.501-2.5-1.5-1.5-5 5 5 5 1.5-1.5-2.5-2.5h8V9H6Z" />, p);

export const ExpandIcon = (p: IconProps) =>
  svg(<path d="M4 16V4H2v12h2ZM13 15l-1.5-1.5L14 11H6V9h8l-2.5-2.5L13 5l5 5-5 5Z" />, p);

export const VideoIcon = (p: IconProps) =>
  svg(<path fillRule="evenodd" d="M2 5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v2.382l4-2V14.62l-4-2V15a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5Zm2 1v8h8V6H4Z" clipRule="evenodd" />, p);

export const LogoutIcon = (p: IconProps) =>
  svg(<path d="M16 18h-4a2 2 0 0 1-2-2v-2h2v2h4V4h-4v2h-2V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2ZM7 5l1.5 1.5L6 9h7v2H6l2.5 2.5L7 15l-5-5 5-5Z" />, p);

export const KeyIcon = (p: IconProps) =>
  svg(<path fillRule="evenodd" d="M12 2a6 6 0 0 0-5.743 7.743L2 14v4h4v-2h2v-2h2l.257-.257A6 6 0 1 0 12 2Zm2 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" clipRule="evenodd" />, p);
