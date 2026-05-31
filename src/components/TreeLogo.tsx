export default function TreeLogo({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="32" cy="24" r="16" fill="#5A7A4A" />
      <circle cx="22" cy="28" r="12" fill="#78A066" fillOpacity="0.85" />
      <circle cx="42" cy="28" r="12" fill="#78A066" fillOpacity="0.85" />
      <path
        d="M30 34C30 29.5817 33.5817 26 38 26H40C44.4183 26 48 29.5817 48 34V35H30V34Z"
        fill="#5A7A4A"
      />
      <path d="M28 36H36V56H28V36Z" fill="#7C4A2D" />
      <path
        d="M17 56C17 50.4772 21.4772 46 27 46H45C50.5228 46 55 50.4772 55 56V58H17V56Z"
        fill="#C9943A"
        fillOpacity="0.3"
      />
      <path
        d="M16 57.5C22 55.5 27 53 31 48.5C35 53 40 55.5 48 57.5"
        stroke="#7C4A2D"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
