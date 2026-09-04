import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Container } from "../../components/section";
import { APP_PATH } from "../../data/content";
import { scrollToHash, useNavigate } from "../../hooks/use-navigate";
import { ProductMockup } from "./product-mockup";

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const navigate = useNavigate();
  return (
    <section id="product" className="relative overflow-hidden bg-canvas pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* soft backdrop shapes */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-surface-2 blur-3xl" />
        <div className="absolute top-[30%] right-[-10%] h-72 w-72 rounded-full bg-accent-soft blur-3xl" />
        <div className="absolute top-[55%] left-[-8%] h-64 w-64 rounded-full bg-surface-3 blur-3xl" />
      </div>

      <Container className="relative">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
            <Badge variant="accent" className="mx-auto">
              <Sparkles className="size-3.5" aria-hidden />
              AI-powered campus intelligence
            </Badge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease }}
            className="mt-6 text-[2.75rem] leading-[1.02] font-semibold tracking-tight text-ink sm:text-6xl lg:text-7xl"
          >
            Your entire campus.{" "}
            <span className="relative inline-block text-accent">
              One intelligent
              <svg
                aria-hidden
                viewBox="0 0 200 12"
                className="absolute -bottom-1 left-0 h-3 w-full text-accent/35"
                preserveAspectRatio="none"
              >
                <path d="M2 8 C 50 2, 150 2, 198 8" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" />
              </svg>
            </span>{" "}
            system.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16, ease }}
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-2"
          >
            Built only for students of Ahsanullah University of Science and Technology. Stop digging through group chats,
            notices, spreadsheets, and schedules — CampusOS brings your university information together and gives you an
            AI agent that can actually get things done.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24, ease }}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Button size="lg" onClick={() => navigate(APP_PATH)} className="w-full sm:w-auto">
              Explore CampusOS
              <ArrowRight className="size-4" aria-hidden />
            </Button>
            <Button size="lg" variant="secondary" onClick={() => scrollToHash("#how-it-works")} className="w-full sm:w-auto">
              See How It Works
            </Button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-5 text-sm font-medium text-ink-3"
          >
            Real campus data <span aria-hidden className="mx-1.5 text-ink-3/60">•</span> Real actions{" "}
            <span aria-hidden className="mx-1.5 text-ink-3/60">•</span> Real-time answers
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.48 }}
            className="mt-3 text-sm text-ink-2"
          >
            AUST students only — sign in with your <span className="font-semibold text-ink">@aust.edu</span>{" "}
            email.
          </motion.p>
        </div>

        <div className="mx-auto mt-16 max-w-5xl sm:mt-20">
          <ProductMockup />
          <p className="mt-6 text-center text-sm text-ink-2">
            <span className="font-semibold text-ink">Data changes → the AI knows immediately.</span> The dashboard
            and the agent read the same live database.
          </p>
        </div>
      </Container>
    </section>
  );
}
