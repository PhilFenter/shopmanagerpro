import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, MapPin, Users, Award } from 'lucide-react';
import { fadeUp } from '@/lib/animations';
import heroWorkshop from '@/assets/hero-workshop.jpg';

const stats = [
  { icon: MapPin, label: 'Based in', value: 'Lewiston, Idaho' },
  { icon: Users, label: 'Happy Customers', value: '500+' },
  { icon: Award, label: 'Five-Star Reviews', value: '100+' },
];

const capabilities = [
  {
    title: 'Laser Engraving',
    desc: 'Precision laser engraving for leather patches with incredible detail.',
  },
  {
    title: 'Multi-Head Embroidery',
    desc: 'High-speed multi-head machines for consistent, production-quality embroidery.',
  },
  {
    title: 'ROQ P-14XL Press',
    desc: '14-color automatic screen printing with CTS technology for precision.',
  },
  {
    title: 'DTF Printing',
    desc: 'Full-color direct-to-film transfers for photo-quality garment decoration.',
  },
];

export default function About() {
  return (
    <div className="dark">
      {/* Hero */}
      <section className="relative pt-24 pb-20 lg:pt-32 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroWorkshop} alt="Workshop" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/50" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <motion.div initial="hidden" animate="visible">
              <motion.p custom={0} variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.2em] text-[hsl(var(--warm))]">
                Our Story
              </motion.p>
              <motion.h1 custom={1} variants={fadeUp} className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl font-serif">
                CRAFTED IN THE HEART OF IDAHO
              </motion.h1>
              <motion.p custom={2} variants={fadeUp} className="mt-6 text-base text-muted-foreground leading-relaxed lg:text-lg">
                Hells Canyon Designs started with a simple idea: businesses deserve custom gear
                that&apos;s as premium as the brands they&apos;ve built. From our shop in Lewiston, Idaho,
                we combine cutting-edge equipment with old-school craftsmanship to deliver work
                that makes your brand unforgettable.
              </motion.p>
              <motion.p custom={3} variants={fadeUp} className="mt-4 text-base text-muted-foreground leading-relaxed lg:text-lg">
                Whether it&apos;s laser-engraved leather patches, precision embroidery, screen
                printing, or our newest DTF transfer capabilities — every order gets the same
                white-glove treatment. Because your brand deserves it.
              </motion.p>
              <motion.div custom={4} variants={fadeUp} className="mt-8">
                <Link to="/custom-hats">
                  <Button
                    size="lg"
                    className="bg-[hsl(var(--warm))] text-[hsl(var(--warm-foreground))] hover:bg-[hsl(var(--warm))/0.9] font-semibold"
                  >
                    Start Your Project
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 bg-card border-y border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                variants={fadeUp}
                className="flex items-center gap-4"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[hsl(var(--warm))]/10">
                  <stat.icon className="h-6 w-6 text-[hsl(var(--warm))]" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-20 lg:py-32 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="text-center"
          >
            <motion.p custom={0} variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.2em] text-[hsl(var(--warm))]">
              Our Capabilities
            </motion.p>
            <motion.h2 custom={1} variants={fadeUp} className="mt-3 text-3xl font-bold font-serif text-foreground sm:text-4xl">
              BUILT FOR QUALITY
            </motion.h2>
            <motion.p custom={2} variants={fadeUp} className="mt-4 text-base text-muted-foreground max-w-2xl mx-auto">
              We&apos;ve invested in the best equipment so you get the best results.
            </motion.p>
          </motion.div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map((cap, i) => (
              <motion.div
                key={cap.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                variants={fadeUp}
                className="rounded-xl border border-border bg-card p-6"
              >
                <h3 className="text-lg font-bold text-foreground">{cap.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{cap.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
