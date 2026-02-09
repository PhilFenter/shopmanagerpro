import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Star, Truck, CheckCircle, Clock, Award } from 'lucide-react';
import { fadeUp } from '@/lib/animations';
import heroHats from '@/assets/hero-hats.jpg';
import heroWorkshop from '@/assets/hero-workshop.jpg';
import heroScreenPrint from '@/assets/hero-screen-print.jpg';
import heroEmbroidery from '@/assets/hero-embroidery.jpg';

const services = [
  {
    title: 'Custom Leather Patch Hats',
    description: 'Laser-engraved, UV-printed, and embroidered patches on premium Richardson & YP hats.',
    image: heroHats,
    href: '/custom-hats',
    tag: 'Most Popular',
  },
  {
    title: 'Screen Printing',
    description: '14-color ROQ P-14XL automatic press with CTS technology for crisp, production-quality prints.',
    image: heroScreenPrint,
    href: '/screen-print-service',
  },
  {
    title: 'Embroidery',
    description: 'Multi-head Barudan machines delivering consistent, vibrant embroidery on any garment.',
    image: heroEmbroidery,
    href: '/embroidery-service',
  },
  {
    title: 'DTF Transfers',
    description: 'Full-color, photo-quality direct-to-film transfers on virtually any fabric.',
    image: heroWorkshop,
    href: '/dtf-transfers',
    tag: 'New',
  },
];

const stats = [
  { icon: Star, value: '100+', label: 'Five-Star Reviews' },
  { icon: Truck, value: '50 States', label: 'Ships Nationwide' },
  { icon: Clock, value: '1 Day', label: 'Quote Turnaround' },
  { icon: Award, value: '500+', label: 'Happy Customers' },
];

const steps = [
  { step: '01', title: 'Tell Us Your Vision', desc: "Share your design, logo, or idea. We'll help refine it." },
  { step: '02', title: 'Get a Free Quote', desc: "We'll send a custom quote within one business day." },
  { step: '03', title: 'We Craft It', desc: 'Your order goes into production with premium materials.' },
  { step: '04', title: 'Delivered to You', desc: 'Free shipping anywhere in the continental U.S.' },
];

const faqs = [
  { q: 'What is the minimum order?', a: '12 pieces for custom hats. Screen printing and embroidery minimums vary by project — contact us for details.' },
  { q: 'How long does an order take?', a: 'Most orders ship within 2-3 weeks. Rush orders available — just ask!' },
  { q: 'Do you ship nationwide?', a: 'Yes! Free shipping anywhere in the continental United States.' },
  { q: 'Can you match my brand colors?', a: 'Absolutely. We use Pantone matching for screen printing and have hundreds of thread colors for embroidery.' },
  { q: 'What file formats do you accept?', a: 'We accept AI, EPS, PDF, PNG, and SVG. We can also help vectorize your logo if needed.' },
];

export default function Landing() {
  return (
    <div className="dark">
      {/* Hero */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroHats} alt="Custom leather patch hats" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/40" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-32 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            animate="visible"
            className="max-w-2xl"
          >
            <motion.p
              custom={0}
              variants={fadeUp}
              className="text-sm font-semibold uppercase tracking-[0.2em] text-[hsl(var(--warm))]"
            >
              Lewiston, Idaho
            </motion.p>
            <motion.h1
              custom={1}
              variants={fadeUp}
              className="mt-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-7xl font-serif"
            >
              YOUR BRAND,{' '}
              <span className="text-[hsl(var(--warm))]">CRAFTED</span>
            </motion.h1>
            <motion.p
              custom={2}
              variants={fadeUp}
              className="mt-6 text-lg text-muted-foreground leading-relaxed sm:text-xl max-w-lg"
            >
              Premium custom hats, screen printing, embroidery & DTF transfers.
              Made in Idaho, shipped nationwide.
            </motion.p>
            <motion.div custom={3} variants={fadeUp} className="mt-8 flex flex-wrap gap-4">
              <Link to="/custom-hats">
                <Button
                  size="lg"
                  className="bg-[hsl(var(--warm))] text-[hsl(var(--warm-foreground))] hover:bg-[hsl(var(--warm))/0.9] text-base font-semibold px-8"
                >
                  Get a Free Quote
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/about">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-border text-foreground hover:bg-card text-base px-8"
                >
                  Our Story
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Services */}
      <section className="py-20 lg:py-32 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="text-center"
          >
            <motion.p custom={0} variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.2em] text-[hsl(var(--warm))]">
              What We Do
            </motion.p>
            <motion.h2 custom={1} variants={fadeUp} className="mt-3 text-3xl font-bold font-serif text-foreground sm:text-4xl">
              OUR SERVICES
            </motion.h2>
          </motion.div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((service, i) => (
              <motion.div
                key={service.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                variants={fadeUp}
              >
                <Link to={service.href} className="group block">
                  <div className="relative overflow-hidden rounded-xl aspect-[4/3]">
                    <img
                      src={service.image}
                      alt={service.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
                    {service.tag && (
                      <span className="absolute top-3 right-3 rounded-full bg-[hsl(var(--warm))] px-3 py-1 text-xs font-bold text-[hsl(var(--warm-foreground))]">
                        {service.tag}
                      </span>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="text-lg font-bold text-foreground">{service.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{service.description}</p>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="py-16 bg-card border-y border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                variants={fadeUp}
                className="text-center"
              >
                <stat.icon className="mx-auto h-8 w-8 text-[hsl(var(--warm))]" />
                <p className="mt-3 text-2xl font-bold text-foreground sm:text-3xl">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 lg:py-32 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="text-center"
          >
            <motion.p custom={0} variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.2em] text-[hsl(var(--warm))]">
              Simple Process
            </motion.p>
            <motion.h2 custom={1} variants={fadeUp} className="mt-3 text-3xl font-bold font-serif text-foreground sm:text-4xl">
              HOW IT WORKS
            </motion.h2>
          </motion.div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <motion.div
                key={step.step}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                variants={fadeUp}
                className="relative rounded-xl border border-border bg-card p-6 text-center"
              >
                <span className="text-4xl font-bold text-[hsl(var(--warm))]/30 font-serif">{step.step}</span>
                <h3 className="mt-3 text-lg font-bold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroWorkshop} alt="Workshop" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-background/85" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <motion.h2 custom={0} variants={fadeUp} className="text-3xl font-bold font-serif text-foreground sm:text-4xl lg:text-5xl">
              READY TO STAND OUT?
            </motion.h2>
            <motion.p custom={1} variants={fadeUp} className="mt-6 text-lg text-muted-foreground">
              Get a free custom quote within one business day. Free shipping nationwide.
            </motion.p>
            <motion.div custom={2} variants={fadeUp} className="mt-8">
              <Link to="/custom-hats">
                <Button
                  size="lg"
                  className="bg-[hsl(var(--warm))] text-[hsl(var(--warm-foreground))] hover:bg-[hsl(var(--warm))/0.9] text-base font-semibold px-10"
                >
                  Start Your Project
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 lg:py-32 bg-background">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="text-center"
          >
            <motion.p custom={0} variants={fadeUp} className="text-sm font-semibold uppercase tracking-[0.2em] text-[hsl(var(--warm))]">
              Common Questions
            </motion.p>
            <motion.h2 custom={1} variants={fadeUp} className="mt-3 text-3xl font-bold font-serif text-foreground sm:text-4xl">
              FAQ
            </motion.h2>
          </motion.div>

          <div className="mt-12 space-y-4">
            {faqs.map((faq, i) => (
              <motion.details
                key={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
                variants={fadeUp}
                className="group rounded-xl border border-border bg-card p-5"
              >
                <summary className="flex cursor-pointer items-center justify-between text-base font-semibold text-foreground">
                  {faq.q}
                  <ChevronIcon />
                </summary>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </motion.details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}
