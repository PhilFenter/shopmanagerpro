import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { fadeUp } from '@/lib/animations';
import heroEmbroidery from '@/assets/hero-embroidery.jpg';

const features = [
  {
    title: 'Multi-Head Barudan Machines',
    desc: 'Our 15-needle Barudan embroidery heads deliver production-speed consistency across every garment.',
  },
  {
    title: 'Hundreds of Thread Colors',
    desc: 'Madeira Polyneon threads with Pantone matching — we can match your exact brand colors.',
  },
  {
    title: 'Any Garment, Any Placement',
    desc: 'Polos, jackets, beanies, bags — left chest, full back, sleeves, or custom placement.',
  },
  {
    title: 'Low Minimums',
    desc: "Whether you need 12 polos for your team or 500 for an event, we've got you covered.",
  },
];

const applications = [
  'Corporate apparel & uniforms',
  'Team & club gear',
  'Hats & beanies',
  'Jackets & outerwear',
  'Bags & accessories',
  'Promotional items',
];

export default function EmbroideryService() {
  return (
    <div className="dark">
      {/* Hero */}
      <section className="relative pt-24 pb-20 lg:pt-32 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroEmbroidery} alt="Embroidery machine" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/50" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div initial="hidden" animate="visible" className="max-w-2xl">
            <motion.p custom={0} variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.2em] text-[hsl(var(--warm))]">
              Custom Embroidery
            </motion.p>
            <motion.h1 custom={1} variants={fadeUp} className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl font-serif">
              PRECISION EMBROIDERY THAT LASTS
            </motion.h1>
            <motion.p custom={2} variants={fadeUp} className="mt-6 text-base text-muted-foreground leading-relaxed lg:text-lg">
              From corporate uniforms to custom hats, our multi-head Barudan embroidery
              machines deliver vibrant, consistent results on any garment. Built to last,
              designed to impress.
            </motion.p>
            <motion.div custom={3} variants={fadeUp} className="mt-6 flex flex-wrap gap-2">
              {['Barudan Machines', '15 Needles', 'Madeira Thread', 'Pantone Matching'].map((tag) => (
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
              Why Choose Us
            </motion.p>
            <motion.h2 custom={1} variants={fadeUp} className="mt-3 text-3xl font-bold font-serif text-foreground sm:text-4xl">
              BUILT FOR PRODUCTION
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

      {/* Applications */}
      <section className="py-16 bg-card border-y border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2 items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[hsl(var(--warm))]">
                Applications
              </p>
              <h3 className="mt-3 text-2xl font-bold font-serif text-foreground">
                EMBROIDERY FOR EVERY NEED
              </h3>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                No matter the garment or application, we've got the setup to handle it.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {applications.map((app) => (
                <div key={app} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 shrink-0 text-[hsl(var(--warm))]" />
                  {app}
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
              READY TO GET STITCHED?
            </motion.h2>
            <motion.p custom={1} variants={fadeUp} className="mt-4 text-base text-muted-foreground">
              Send us your logo and we'll get you a quote within one business day.
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
