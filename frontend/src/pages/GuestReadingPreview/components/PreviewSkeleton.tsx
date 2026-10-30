import React from "react";
import { TarotCorners } from "@/components/mystic/MysticDivider";

export const PreviewSkeleton: React.FC = () => {
  return (
    <main
      data-testid="preview-loading-skeleton"
      className="w-full min-h-[calc(100vh-72px)] py-10 sm:py-12 text-ink animate-pulse"
    >
      <div className="max-w-[1000px] mx-auto px-4">
        {/* Banner skeleton */}
        <div className="h-12 w-full rounded bg-[#140d26]/80 border border-hairline/60 mb-6" />

        {/* Header / Summary Card Skeleton */}
        <div className="relative mystic-card rounded p-6 sm:p-9 mb-8">
          <TarotCorners />
          <div className="h-6 w-48 bg-[#241842] rounded mb-4" />
          <div className="space-y-2 mb-6">
            <div className="h-4 w-full bg-[#1b1233] rounded" />
            <div className="h-4 w-5/6 bg-[#1b1233] rounded" />
            <div className="h-4 w-3/4 bg-[#1b1233] rounded" />
          </div>

          {/* Section Skeletons */}
          <div className="space-y-4">
            <div className="h-28 w-full rounded bg-[#140d26]/60 border border-hairline/50 p-4" />
            <div className="h-28 w-full rounded bg-[#140d26]/60 border border-hairline/50 p-4" />
            <div className="h-24 w-full rounded bg-[#140d26]/40 border border-hairline/30 p-4" />
          </div>
        </div>
      </div>
    </main>
  );
};

export default PreviewSkeleton;
