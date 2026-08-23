type IconProps = { className?: string };

const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export function RetailerIcon(props: IconProps) {
  return <svg {...common} {...props}><path d="M4 10h16M5 10V20h14V10M3 10l2-6h14l2 6" /><path d="M8 14h3v6M15 14h2" /></svg>;
}

export function StudioIcon(props: IconProps) {
  return <svg {...common} {...props}><rect x="5" y="7" width="14" height="12" rx="3" /><path d="M9 12h.01M15 12h.01M9 16h6M12 3v4M10 3h4" /></svg>;
}

export function SchemaIcon(props: IconProps) {
  return <svg {...common} {...props}><path d="M12 3 20 7v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7l8-4Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></svg>;
}

export function OfferIcon(props: IconProps) {
  return <svg {...common} {...props}><path d="M4 5h16v14H4zM4 9h16M8 13h4M8 16h7" /></svg>;
}

export function ArrowIcon(props: IconProps) {
  return <svg {...common} {...props}><path d="M5 12h14M14 7l5 5-5 5" /></svg>;
}

export function PlayIcon(props: IconProps) {
  return <svg {...common} {...props}><path d="m9 7 8 5-8 5V7Z" /></svg>;
}
