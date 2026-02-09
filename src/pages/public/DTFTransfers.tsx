import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle, ExternalLink } from 'lucide-react';
import { fadeUp } from '@/lib/animations';
import heroWorkshop from '@/assets/hero-workshop.jpg';

const tags = ['Full Color', 'Photo Quality', 'Any Fabric', 'No Color Limits', 'Gang Sheets'];

export default function DTFTransfers() {
  return (
    <div className="dark">
      {/* Hero */}
      <section className="relative pt-24 pb-20 lg:pt-32 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroWorkshop} alt="DTF printing" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/50" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" animate="visible" className="max-w-2xl">
            <motion.span custom={0} variants={fadeUp} className="inline-block rounded-full bg-[hsl(var(--warm))]/10 border border-[hsl(var(--warm))]/30 px-4 py-1 text-xs font-bold text-[hsl(var(--warm))] uppercase tracking-wider">
              New Service
            </motion.span>
            <motion.h1 custom={1} variants={fadeUp} className="mt-6 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl font-serif">
              DTF TRANSFERS & GARMENTS
            </motion.h1>
            <motion.p custom={2} variants={fadeUp} className="mt-6 text-base text-muted-foreground leading-relaxed lg:text-lg">
              Direct-to-Film transfers deliver photo-quality, full-color prints on virtually
              any fabric. No color limits, no minimums on transfer sheets, incredible detail
              — perfect for brands that want to stand out.
            </motion.p>
            <motion.div custom={3} variants={fadeUp} className="mt-6 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Two Ways */}
      <section className="py-20 lg:py-32 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="text-center"
          >
            <motion.p custom={0} variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.2em] text-[hsl(var(--warm))]">
              Two Ways to Order
            </motion.p>
            <motion.h2 custom={1} variants={fadeUp} className="mt-3 text-3xl font-bold font-serif text-foreground sm:text-4xl">
              YOUR CHOICE, YOUR WAY
            </motion.h2>
            <motion.p custom={2} variants={fadeUp} className="mt-4 text-base text-muted-foreground max-w-2xl mx-auto">
              Need finished garments or just the transfer sheets? We've got both options covered.
            </motion.p>
          </motion.div>

          <div className="mt-16 grid gap-8 lg:grid-cols-2">
            {/* Custom Garments */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={0}
              variants={fadeUp}
              className="rounded-xl border border-border bg-card p-8"
            >
              <h3 className="text-xl font-bold text-foreground font-serif">CUSTOM DTF GARMENTS</h3>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                We print it for you. Choose your garment, upload your design, and we handle
                the rest — from printing the transfer to pressing it on your garments.
              </p>
              <ul className="mt-6 space-y-3">
                {['We source the garments', 'Full-color photo quality', 'Ready to wear / sell'].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 shrink-0 text-[hsl(var(--warm))]" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-8 bg-[hsl(var(--warm))] text-[hsl(var(--warm-foreground))] hover:bg-[hsl(var(--warm))/0.9] font-semibold"
              >
                Request a Quote
              </Button>
            </motion.div>

            {/* Gang Sheets */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={1}
              variants={fadeUp}
              className="rounded-xl border border-border bg-card p-8"
            >
              <h3 className="text-xl font-bold text-foreground font-serif">GANG SHEET BUILDER</h3>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                Order DTF transfer sheets directly — build your own gang sheets with our easy
                online tool. Upload your designs, arrange them on a sheet, and order.
              </p>
              <ul className="mt-6 space-y-3">
                {['Build your own layouts', 'No minimum order', 'You press them yourself'].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4 shrink-0 text-[hsl(var(--warm))]" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                className="mt-8 border-border text-foreground hover:bg-accent font-semibold"
              >
                Build Your Gang Sheet
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Quote CTA */}
      <section className="py-20 lg:py-32 bg-card border-t border-border">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <motion.p custom={0} variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.2em] text-[hsl(var(--warm))]">
              Request a DTF Quote
            </motion.p>
            <motion.h2 custom={1} variants={fadeUp} className="mt-3 text-3xl font-bold font-serif text-foreground sm:text-4xl">
              READY TO PRINT?
            </motion.h2>
            <motion.p custom={2} variants={fadeUp} className="mt-4 text-base text-muted-foreground">
              Walk through a few quick steps and we'll send you a custom DTF quote within one business day.
            </motion.p>
            <motion.div custom={3} variants={fadeUp} className="mt-8 rounded-xl border border-border bg-background p-8">
              <p className="text-lg font-semibold text-foreground">DTF Quote Builder Coming Soon</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Contact us directly for a custom DTF quote — we'll respond within 24 hours.
              </p>
              <Button
                size="lg"
                className="mt-6 bg-[hsl(var(--warm))] text-[hsl(var(--warm-foreground))] hover:bg-[hsl(var(--warm))/0.9] font-semibold"
              >
                Contact Us
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
