import { Outlet } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MysticBackground from "@/components/mystic/MysticBackground";

interface DefaultLayoutProps {
  children?: React.ReactNode;
}

const DefaultLayout = ({ children }: DefaultLayoutProps) => {
  return (
    <div className="component:DefaultLayout relative min-h-screen bg-canvas text-ink font-sans flex flex-col selection:bg-mystic-gold/30 overflow-x-clip">
      <MysticBackground />
      <Navbar />
      <main className="relative z-10 flex-1 w-full flex flex-col">
        {children ?? <Outlet />}
      </main>
      <Footer />
    </div>
  );
};

export default DefaultLayout;
