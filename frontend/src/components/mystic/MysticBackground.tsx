import React from "react";

const STAR_POSITIONS = [
  { top: "6%", left: "12%", size: 2, delay: "0s", duration: "3.5s" },
  { top: "14%", left: "28%", size: 1.5, delay: "1.2s", duration: "4.2s" },
  { top: "9%", left: "72%", size: 2.5, delay: "0.5s", duration: "3.8s" },
  { top: "19%", left: "86%", size: 1.5, delay: "2.1s", duration: "4.5s" },
  { top: "28%", left: "8%", size: 2, delay: "0.8s", duration: "5s" },
  { top: "36%", left: "92%", size: 2, delay: "1.7s", duration: "3.9s" },
  { top: "48%", left: "15%", size: 1.5, delay: "2.5s", duration: "4.1s" },
  { top: "54%", left: "81%", size: 2.5, delay: "0.3s", duration: "3.6s" },
  { top: "67%", left: "6%", size: 2, delay: "1.4s", duration: "4.8s" },
  { top: "73%", left: "89%", size: 1.5, delay: "2.8s", duration: "3.7s" },
  { top: "84%", left: "22%", size: 2, delay: "0.9s", duration: "4.4s" },
  { top: "88%", left: "68%", size: 2.5, delay: "1.9s", duration: "5.2s" },
  { top: "42%", left: "48%", size: 1.5, delay: "1.1s", duration: "4s" },
  { top: "22%", left: "54%", size: 2, delay: "2.3s", duration: "3.4s" },
];

export const MysticBackground: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
    >
      <div
        className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full opacity-35 blur-[130px]"
        style={{
          background:
            "radial-gradient(circle, rgba(139,92,246,0.45) 0%, rgba(212,175,55,0.18) 45%, transparent 75%)",
        }}
      />
      <div
        className="absolute top-[35%] -left-[15%] w-[600px] h-[600px] rounded-full opacity-25 blur-[140px]"
        style={{
          background:
            "radial-gradient(circle, rgba(168,85,247,0.35) 0%, rgba(79,70,229,0.15) 55%, transparent 75%)",
        }}
      />
      <div
        className="absolute -bottom-[15%] -right-[10%] w-[700px] h-[650px] rounded-full opacity-25 blur-[140px]"
        style={{
          background:
            "radial-gradient(circle, rgba(212,175,55,0.28) 0%, rgba(139,92,246,0.2) 50%, transparent 75%)",
        }}
      />

      <svg
        className="absolute -top-36 -right-36 w-[520px] h-[520px] text-[#d4af37]/[0.05] animate-spin-slow"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="200" cy="200" r="190" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" />
        <circle cx="200" cy="200" r="165" stroke="currentColor" strokeWidth="1" />
        <circle cx="200" cy="200" r="130" stroke="currentColor" strokeWidth="1" strokeDasharray="2 4" />
        <circle cx="200" cy="200" r="95" stroke="currentColor" strokeWidth="1" />
        <polygon
          points="200,35 248,152 365,200 248,248 200,365 152,248 35,200 152,152"
          stroke="currentColor"
          strokeWidth="1"
        />
        <polygon
          points="83,83 200,135 317,83 265,200 317,317 200,265 83,317 135,200"
          stroke="currentColor"
          strokeWidth="1"
        />
        <line x1="200" y1="10" x2="200" y2="390" stroke="currentColor" strokeWidth="0.75" />
        <line x1="10" y1="200" x2="390" y2="200" stroke="currentColor" strokeWidth="0.75" />
        <line x1="65" y1="65" x2="335" y2="335" stroke="currentColor" strokeWidth="0.75" />
        <line x1="335" y1="65" x2="65" y2="335" stroke="currentColor" strokeWidth="0.75" />
      </svg>

      <svg
        className="absolute -bottom-44 -left-44 w-[560px] h-[560px] text-[#a855f7]/[0.05] animate-spin-reverse-slow"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="200" cy="200" r="185" stroke="currentColor" strokeWidth="1" />
        <circle cx="200" cy="200" r="150" stroke="currentColor" strokeWidth="1" strokeDasharray="6 6" />
        <polygon
          points="200,50 330,275 70,275"
          stroke="currentColor"
          strokeWidth="1"
        />
        <polygon
          points="200,350 330,125 70,125"
          stroke="currentColor"
          strokeWidth="1"
        />
      </svg>

      {STAR_POSITIONS.map((star, idx) => (
        <span
          key={idx}
          className="absolute rounded-full bg-[#f7e7b4] animate-pulse-glow"
          style={{
            top: star.top,
            left: star.left,
            width: `${star.size * 2}px`,
            height: `${star.size * 2}px`,
            animationDelay: star.delay,
            animationDuration: star.duration,
            boxShadow: "0 0 8px 1px rgba(247, 231, 180, 0.7)",
          }}
        />
      ))}
    </div>
  );
};

export default MysticBackground;
