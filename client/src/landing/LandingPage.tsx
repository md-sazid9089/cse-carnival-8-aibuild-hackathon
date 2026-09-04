import { MotionConfig } from "framer-motion";
import { NavigateProvider, type Navigate } from "./hooks/use-navigate";
import { AiAgent } from "./sections/ai-agent";
import { CampusSystems } from "./sections/campus-systems";
import { Capabilities } from "./sections/capabilities";
import { Comparison } from "./sections/comparison";
import { DashboardPreview } from "./sections/dashboard-preview";
import { FinalCta } from "./sections/final-cta";
import { Footer } from "./sections/footer";
import { Hero } from "./sections/hero/hero";
import { HowItWorks } from "./sections/how-it-works";
import { Navbar } from "./sections/navbar";
import { Problem } from "./sections/problem";
import { Realtime } from "./sections/realtime";
import { Reliability } from "./sections/reliability";
import { Trust } from "./sections/trust";
import { Workflow } from "./sections/workflow";

export default function LandingPage({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <MotionConfig reducedMotion="user">
      <NavigateProvider value={onNavigate}>
        <div className="landing min-h-screen bg-cream-50 text-forest-deep">
          <a
            href="#product"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-forest-deep focus:px-4 focus:py-2 focus:text-cream-50"
          >
            Skip to content
          </a>
          <Navbar />
          <main>
            <Hero />
            <Problem />
            <CampusSystems />
            <AiAgent />
            <Capabilities />
            <Workflow />
            <Realtime />
            <Trust />
            <HowItWorks />
            <DashboardPreview />
            <Comparison />
            <Reliability />
            <FinalCta />
          </main>
          <Footer />
        </div>
      </NavigateProvider>
    </MotionConfig>
  );
}
