import React from "react";

interface MysticPalmOracleProps {
  className?: string;
}

export const MysticPalmOracle: React.FC<MysticPalmOracleProps> = ({
  className = "",
}) => {
  return (
    <div
      aria-hidden="true"
      className={`relative flex items-center justify-center select-none ${className}`}
    >
      <div
        className="absolute w-72 h-72 sm:w-80 sm:h-80 rounded-full blur-3xl opacity-50 animate-pulse-glow"
        style={{
          background:
            "radial-gradient(circle, rgba(212,175,55,0.35) 0%, rgba(168,85,247,0.28) 55%, transparent 75%)",
        }}
      />

      <svg
        className="w-72 h-72 sm:w-80 sm:h-80 md:w-96 md:h-96 animate-spin-slow text-[#d4af37]/40"
        viewBox="0 0 360 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="180"
          cy="180"
          r="172"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="3 6"
        />
        <circle
          cx="180"
          cy="180"
          r="156"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        <circle
          cx="180"
          cy="180"
          r="134"
          stroke="currentColor"
          strokeWidth="0.8"
          strokeDasharray="6 4"
        />
        <polygon
          points="180,24 222,138 336,180 222,222 180,336 138,222 24,180 138,138"
          stroke="currentColor"
          strokeWidth="0.9"
        />
        <polygon
          points="70,70 180,118 290,70 242,180 290,290 180,242 70,290 118,180"
          stroke="currentColor"
          strokeWidth="0.9"
        />
        <circle cx="180" cy="24" r="4" fill="#f7e7b4" />
        <circle cx="336" cy="180" r="4" fill="#f7e7b4" />
        <circle cx="180" cy="336" r="4" fill="#f7e7b4" />
        <circle cx="24" cy="180" r="4" fill="#f7e7b4" />
      </svg>

      <svg
        className="absolute w-56 h-56 sm:w-64 sm:h-64 md:w-72 md:h-72 animate-spin-reverse-slow text-[#a855f7]/45"
        viewBox="0 0 260 260"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="130"
          cy="130"
          r="122"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="2 5"
        />
        <polygon
          points="130,16 229,187 31,187"
          stroke="currentColor"
          strokeWidth="0.9"
        />
        <polygon
          points="130,244 229,73 31,73"
          stroke="currentColor"
          strokeWidth="0.9"
        />
      </svg>

      <svg
        className="absolute w-48 h-60 sm:w-56 sm:h-68 md:w-60 md:h-72 drop-shadow-[0_0_18px_rgba(212,175,55,0.45)] animate-float"
        viewBox="0 0 200 260"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="palmOutlineGrad" x1="0" y1="0" x2="200" y2="260" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fff3d1" />
            <stop offset="50%" stopColor="#d4af37" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
          <linearGradient id="palmFillGrad" x1="100" y1="15" x2="100" y2="245" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2c1d4f" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#0b0716" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        <path
          d="M 52 188
             C 42 172 24 145 16 128
             C 11 117 16 106 27 110
             C 39 115 55 136 64 145
             C 63 122 59 66 61 48
             C 62 38 74 38 75 48
             C 77 65 79 108 81 116
             C 82 96 83 34 86 19
             C 88 8 100 8 102 19
             C 104 38 104 98 105 116
             C 108 96 113 47 117 34
             C 120 25 132 26 133 36
             C 135 59 133 110 133 127
             C 137 114 145 81 151 73
             C 157 66 168 71 165 82
             C 160 105 152 150 151 178
             C 149 210 139 242 130 250
             L 66 250
             C 57 242 54 214 52 188 Z"
          fill="url(#palmFillGrad)"
          stroke="url(#palmOutlineGrad)"
          strokeWidth="2"
        />

        <path
          d="M 148 148 C 126 146 98 136 74 124"
          stroke="#fb7185"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M 66 146 C 92 148 118 160 138 176"
          stroke="#c084fc"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M 65 140 C 86 158 92 192 84 232"
          stroke="#f5d77f"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M 103 236 C 102 198 101 164 100 128"
          stroke="#34d399"
          strokeWidth="1.8"
          strokeDasharray="3 3"
          strokeLinecap="round"
        />

        <circle cx="71" cy="122" r="2.5" fill="#fff3d1" />
        <circle cx="96" cy="119" r="2.5" fill="#fff3d1" />
        <circle cx="121" cy="123" r="2.5" fill="#fff3d1" />
        <circle cx="143" cy="134" r="2.5" fill="#fff3d1" />

        <path
          d="M 84 166 Q 104 152 124 166 Q 104 180 84 166 Z"
          stroke="#f7e7b4"
          strokeWidth="1.5"
          fill="rgba(212, 175, 55, 0.15)"
        />
        <circle cx="104" cy="166" r="5" fill="#d4af37" />
        <circle cx="104" cy="166" r="2" fill="#0b0716" />

        <path
          d="M 134 202 A 7 7 0 1 1 127 212 A 5.5 5.5 0 1 0 134 202 Z"
          fill="#f7e7b4"
        />
      </svg>
    </div>
  );
};

export default MysticPalmOracle;
