import { MotionConfig } from "framer-motion";
import { NavigateProvider, type Navigate } from "./hooks/use-navigate";
import { AiAgent } from "./sections/ai-agent";
import { FinalCta } from "./sections/final-cta";
import { Footer } from "./sections/footer";
import { Hero } from "./sections/hero/hero";
import { Navbar } from "./sections/navbar";
import { Problem } from "./sections/problem";
import { Realtime } from "./sections/realtime";
import { Trust } from "./sections/trust";

export default function LandingPage({ onNavigate }: { onNavigate: Navigate }) {
  return (
    <MotionConfig reducedMotion="user">
      <NavigateProvider value={onNavigate}>
        <div className="min-h-screen bg-canvas text-ink">
          <a
            href="#product"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-ink-invert"
          >
            Skip to content
          </a>
          <Navbar />
          <main>
            <Hero />
            <Problem />
            <AiAgent />
            <Realtime />
            <Trust />
            <FinalCta />
          </main>
          <Footer />
        </div>
      </NavigateProvider>
    </MotionConfig>
  );
}
