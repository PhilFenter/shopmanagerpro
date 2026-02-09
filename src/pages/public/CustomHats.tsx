import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle } from 'lucide-react';
import { fadeUp } from '@/lib/animations';
import heroHats from '@/assets/hero-hats.jpg';

const tags = ['Laser Engraved Leather', 'UV Printed', 'Embroidered Patches', 'Richardson 112', 'YP Classics'];

const patches = [
  {
    title: 'Laser Engraved Leather',
    desc: 'Our most popular option. Genuine leather patches precision-engraved with your logo for a rugged, premium look that lasts.',
    features: ['Genuine leather', 'Incredible detail', 'Classic & durable'],
  },
  {
    title: 'UV Printed Patches',
    desc: 'Full-color UV printing directly on leather or leatherette. Perfect for detailed logos, gradients, and photo-realistic designs.',
    features: ['Full color', 'Photo quality', 'Vibrant detail'],
  },
  {
    title: 'Embroidered Patches',
    desc: 'Traditional embroidered patches sewn onto your hats. Vibrant thread colors and a classic textile look.',
    features: ['Vibrant colors', 'Classic look', 'Sewn-on'],
  },
];

const trustStats = [
  { value: '4,000+', label: 'Hats in Stock' },
  { value: '100+', label: 'Five-Star Reviews' },
  { value: '50 States', label: 'Shipped Nationwide' },
  { value: '1 Day', label: 'Quote Turnaround' },
];

export default function CustomHats() {
  return (
    <div className="dark">
      {/* Hero */}
      <section className="relative pt-24 pb-20 lg:pt-32 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroHats} alt="Custom hats" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/40" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <motion.div initial="hidden" animate="visible">
              <motion.p custom={0} variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.2em] text-[hsl(var(--warm))]">
                Our Signature Service
              </motion.p>
              <motion.h1 custom={1} variants={fadeUp} className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl font-serif">
                CUSTOM LEATHER PATCH HATS
              </motion.h1>
              <motion.p custom={2} variants={fadeUp} className="mt-6 text-base text-muted-foreground leading-relaxed lg:text-lg">
                From laser-engraved leather to UV printed and embroidered patches — we craft
                premium custom hats that make your brand stand out. Choose from Richardson,
                YP Classics, and more, with over 4,000 hats in stock. 12 piece minimum order.
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
        </div>
      </section>

      {/* Patch Types */}
      <section className="py-20 lg:py-32 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="text-center"
          >
            <motion.p custom={0} variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.2em] text-[hsl(var(--warm))]">
              Patch Types
            </motion.p>
            <motion.h2 custom={1} variants={fadeUp} className="mt-3 text-3xl font-bold font-serif text-foreground sm:text-4xl">
              CHOOSE YOUR STYLE
            </motion.h2>
            <motion.p custom={2} variants={fadeUp} className="mt-4 text-base text-muted-foreground max-w-2xl mx-auto">
              We offer multiple patch styles to match your brand's look and feel.
            </motion.p>
          </motion.div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {patches.map((patch, i) => (
              <motion.div
                key={patch.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                variants={fadeUp}
                className="rounded-xl border border-border bg-card p-6"
              >
                <h3 className="text-lg font-bold text-foreground">{patch.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{patch.desc}</p>
                <ul className="mt-4 space-y-2">
                  {patch.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-[hsl(var(--warm))]" />
                      {f}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Stats */}
      <section className="py-16 bg-card border-y border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {trustStats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                variants={fadeUp}
                className="text-center"
              >
                <p className="text-2xl font-bold text-[hsl(var(--warm))] sm:text-3xl">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Quote CTA */}
      <section className="py-20 lg:py-32 bg-background">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }}>
            <motion.p custom={0} variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.2em] text-[hsl(var(--warm))]">
              Request a Quote
            </motion.p>
            <motion.h2 custom={1} variants={fadeUp} className="mt-3 text-3xl font-bold font-serif text-foreground sm:text-4xl">
              LET'S BUILD YOUR HATS
            </motion.h2>
            <motion.p custom={2} variants={fadeUp} className="mt-4 text-base text-muted-foreground max-w-xl mx-auto">
              Walk through a few quick steps and we'll send you a custom quote within one
              business day. Free shipping anywhere in the U.S.
            </motion.p>
            <motion.div custom={3} variants={fadeUp} className="mt-8 rounded-xl border border-border bg-card p-8">
              <p className="text-lg font-semibold text-foreground">Quote Builder Coming Soon</p>
              <p className="mt-2 text-sm text-muted-foreground">
                In the meantime, reach out to us directly and we'll get you a quote within 24 hours.
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
