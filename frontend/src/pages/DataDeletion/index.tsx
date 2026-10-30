import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { TarotCorners } from "@/components/mystic/MysticDivider";
import InfoTabNav from "./components/InfoTabNav";
import DataDeletionContent from "./components/DataDeletionContent";
import TermsContent from "./components/TermsContent";
import PrivacyContent from "./components/PrivacyContent";
import type { InfoTab } from "./types";

interface DataDeletionPageProps {
  initialTab?: InfoTab;
}

const resolveTabFromPath = (pathname: string, fallback: InfoTab): InfoTab => {
  if (pathname.includes("/terms")) return "terms";
  if (pathname.includes("/privacy")) return "privacy";
  if (pathname.includes("/data-deletion")) return "deletion";
  return fallback;
};

export const DataDeletion = ({ initialTab = "deletion" }: DataDeletionPageProps) => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<InfoTab>(() =>
    resolveTabFromPath(location.pathname, initialTab)
  );

  useEffect(() => {
    setActiveTab(resolveTabFromPath(location.pathname, initialTab));
  }, [location.pathname, initialTab]);

  return (
    <div className="component:DataDeletion flex-1 w-full max-w-[920px] mx-auto px-4 pt-10 md:pt-14 pb-20 font-sans text-ink">
      <InfoTabNav activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="relative w-full mystic-card rounded-2xl p-6 sm:p-10 overflow-hidden">
        <TarotCorners />
        <div className="relative z-10">
          {activeTab === "deletion" && <DataDeletionContent />}
          {activeTab === "terms" && <TermsContent />}
          {activeTab === "privacy" && <PrivacyContent />}
        </div>
      </main>
    </div>
  );
};

export const Terms = () => <DataDeletion initialTab="terms" />;
export const Privacy = () => <DataDeletion initialTab="privacy" />;

export default DataDeletion;
