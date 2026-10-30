import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import HeroSection from "./components/HeroSection";
import HowItWorksSection from "./components/HowItWorksSection";
import SchoolsSection from "./components/SchoolsSection";
import SampleResultSection from "./components/SampleResultSection";
import CreditsSection from "./components/CreditsSection";
import FaqSection from "./components/FaqSection";
import CtaSection from "./components/CtaSection";

export const Homepage = () => {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const targetId = location.hash.replace("#", "");
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [location.hash]);

  return (
    <div className="component:Homepage relative w-full flex flex-col text-ink pb-28">
      <HeroSection />
      <HowItWorksSection />
      <SchoolsSection />
      <SampleResultSection />
      <CreditsSection />
      <FaqSection />
      <CtaSection />
    </div>
  );
};

export default Homepage;
