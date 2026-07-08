export function Logo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 160 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Growth Chart Graphic */}
      <path
        d="M4 24 L12 16 L20 20 L32 4"
        stroke="#0ea5e9"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="4" r="3" fill="#0ea5e9" />
      
      {/* "NEER" text */}
      <text
        x="44"
        y="22"
        fontFamily="sans-serif"
        fontSize="20"
        fontWeight="800"
        fill="currentColor"
        letterSpacing="0.05em"
      >
        NEER
      </text>

      {/* "capital" text */}
      <text
        x="110"
        y="22"
        fontFamily="sans-serif"
        fontSize="12"
        fontWeight="400"
        fill="currentColor"
        opacity="0.8"
      >
        capital
      </text>
    </svg>
  );
}
