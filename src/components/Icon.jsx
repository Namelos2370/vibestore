// Icônes vectorielles (traits fins, couleur héritée) et badge « artiste vérifié ».
const P = {
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />,
  pause: <><rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" /><rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" />,
  share: <><path d="M12 15V4M8 8l4-4 4 4" /><path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></>,
  lyrics: <><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></>,
  clip: <><rect x="3" y="6" width="13" height="12" rx="2.5" /><path d="M16 10.5l5-3v9l-5-3z" /></>,
  up: <path d="M12 19V6M6.5 11.5L12 6l5.5 5.5" />,
  arrowUp: <path d="M12 18V7M7 11l5-5 5 5" />,
  arrowDown: <path d="M12 6v11M7 13l5 5 5-5" />,
}
export function Icon({ name, size = 20, fill = false, className = '', ...rest }) {
  return (
    <svg className={'icon ' + className} width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}>{P[name]}</svg>
  )
}
/** Badge officiel « artiste vérifié » : sceau dentelé avec coche. */
export function Verified({ size = 18 }) {
  return (
    <span className="vbadge" role="img" aria-label="Artiste vérifié" title="Artiste vérifié">
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 1.8l2.4 1.7 2.9-.2 1.2 2.7 2.6 1.3-.3 2.9L22.4 12l-1.6 2.4.3 2.9-2.6 1.3-1.2 2.7-2.9-.2L12 22.2l-2.4-1.7-2.9.2-1.2-2.7-2.6-1.3.3-2.9L1.6 12l1.6-2.4-.3-2.9 2.6-1.3 1.2-2.7 2.9.2z" fill="url(#vg)" />
        <defs><linearGradient id="vg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3b82f6" /><stop offset="1" stopColor="#1d4ed8" /></linearGradient></defs>
        <path d="M7.8 12.3l2.9 2.9 5.6-5.8" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}
