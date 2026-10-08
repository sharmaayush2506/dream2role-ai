// Brand mark: a minimal geometric rocket (body, porthole, fins, flame) tilted for motion,
// on a rounded green tile. Paths are drawn upright on a 24px grid, then rotated as a group.
export function RocketMark({ size = 32, tile = true }: { size?: number; tile?: boolean }) {
  return (
    <svg className="rocket-mark" width={size} height={size} viewBox="0 0 24 24" role="img" aria-hidden="true">
      {tile && <rect width="24" height="24" rx="6.5" fill="var(--brand, #16a34a)" />}
      <g transform="translate(12 12.4) rotate(45) scale(0.86) translate(-12 -11.6)" fill={tile ? "#fff" : "currentColor"}>
        {/* body with a pointed nose */}
        <path d="M12 2.6c2.9 2.1 4.1 5.2 4.1 8.8v4.2H7.9v-4.2c0-3.6 1.2-6.7 4.1-8.8Z" />
        {/* fins */}
        <path d="M7.9 11.9 5.2 14.7v3.4l2.7-1.6Z" />
        <path d="M16.1 11.9l2.7 2.8v3.4l-2.7-1.6Z" />
        {/* flame */}
        <path d="M10.1 16.6h3.8L12 21.2Z" fill="#fbbf24" />
        {/* porthole, cut out in the tile colour */}
        <circle cx="12" cy="9.6" r="1.75" fill={tile ? "var(--brand, #16a34a)" : "var(--bg)"} />
      </g>
    </svg>
  );
}

/** Mark + "dream2role" wordmark. */
export default function Logo({ size = 30, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`logo ${className}`} aria-label="dream2role">
      <RocketMark size={size} />
      <span className="logo-word" aria-hidden="true">
        dream<span className="logo-two">2</span>role
      </span>
    </span>
  );
}
