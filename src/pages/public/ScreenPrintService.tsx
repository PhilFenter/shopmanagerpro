import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { fadeUp } from '@/lib/animations';
import heroScreenPrint from '@/assets/hero-screen-print.jpg';

const features = [
  {
    title: 'ROQ P-14XL Automatic Press',
    desc: '14-color, 16-station automatic press for high-volume, perfectly registered prints every time.',
  },
  {
    title: 'Computer-to-Screen (CTS)',
    desc: 'No film positives needed. Direct-to-screen imaging for the sharpest detail and fastest setup.',
  },
  {
    title: 'Pantone Color Matching',
    desc: 'We mix inks to your exact Pantone specs so your brand colors are always spot-on.',
  },
  {
    title: 'Water-Based & Plastisol',
    desc: 'Soft-hand water-based inks for a vintage feel, or classic plastisol for bold, vibrant prints.',
  },
];

const printTypes = [
  'Spot color printing',
  'Simulated process',
  'CMYK / full color',
  'Discharge printing',
  'Metallic & specialty inks',
  'Oversized prints',
];

export default function ScreenPrintService() {
  return (
    <div className="dark">
      {/* Hero */}
      <section className="relative pt-24 pb-20 lg:pt-32 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroScreenPrint} alt="Screen printing press" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/50" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" animate="visible" className="max-w-2xl">
            <motion.p custom={0} variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.2em] text-[hsl(var(--warm))]">
              Screen Printing
            </motion.p>
            <motion.h1 custom={1} variants={fadeUp} className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl font-serif">
              PRODUCTION-GRADE SCREEN PRINTING
            </motion.h1>
            <motion.p custom={2} variants={fadeUp} className="mt-6 text-base text-muted-foreground leading-relaxed lg:text-lg">
              Our ROQ P-14XL automatic press delivers flawless 14-color prints with
              computer-to-screen precision. From 24-piece team orders to 10,000-piece runs,
              every print comes out perfect.
            </motion.p>
            <motion.div custom={3} variants={fadeUp} className="mt-6 flex flex-wrap gap-2">
              {['14 Colors', 'ROQ P-14XL', 'CTS Technology', 'Water-Based Inks', 'Pantone Matching'].map((tag) => (
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

      {/* Features */}
      <section className="py-20 lg:py-32 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="text-center"
          >
            <motion.p custom={0} variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.2em] text-[hsl(var(--warm))]">
              Our Equipment
            </motion.p>
            <motion.h2 custom={1} variants={fadeUp} className="mt-3 text-3xl font-bold font-serif text-foreground sm:text-4xl">
              SERIOUS HARDWARE
            </motion.h2>
          </motion.div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                variants={fadeUp}
                className="rounded-xl border border-border bg-card p-6"
              >
                <h3 className="text-lg font-bold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Print Types */}
      <section className="py-16 bg-card border-y border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2 items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[hsl(var(--warm))]">
                Print Methods
              </p>
              <h3 className="mt-3 text-2xl font-bold font-serif text-foreground">
                EVERY TECHNIQUE COVERED
              </h3>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                From simple one-color prints to complex simulated process work, we do it all.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {printTypes.map((type) => (
                <div key={type} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 shrink-0 text-[hsl(var(--warm))]" />
                  {type}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 lg:py-32 bg-background">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <motion.h2 custom={0} variants={fadeUp} className="text-3xl font-bold font-serif text-foreground sm:text-4xl">
              READY TO PRINT?
            </motion.h2>
            <motion.p custom={1} variants={fadeUp} className="mt-4 text-base text-muted-foreground">
              Tell us about your project and we'll send you a quote within one business day.
            </motion.p>
            <motion.div custom={2} variants={fadeUp} className="mt-8">
              <Button
                size="lg"
                className="bg-[hsl(var(--warm))] text-[hsl(var(--warm-foreground))] hover:bg-[hsl(var(--warm))/0.9] font-semibold px-10"
              >
                Get a Quote
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
