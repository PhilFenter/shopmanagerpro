import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Menu, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const services = [
  { name: 'Custom Hats', href: '/custom-hats' },
  { name: 'Screen Printing', href: '/screen-print-service' },
  { name: 'Embroidery', href: '/embroidery-service' },
  { name: 'DTF Transfers', href: '/dtf-transfers' },
];

const navLinks = [
  { name: 'About', href: '/about' },
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setServicesOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background dark">
      {/* Header */}
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          scrolled
            ? 'bg-background/95 backdrop-blur-md border-b border-border shadow-lg'
            : 'bg-transparent'
        )}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between lg:h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-foreground font-serif lg:text-2xl">
                HELLS CANYON DESIGNS
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden items-center gap-1 lg:flex">
              {/* Services Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => setServicesOpen(true)}
                onMouseLeave={() => setServicesOpen(false)}
              >
                <button
                  className="flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Services
                  <ChevronDown className={cn('h-4 w-4 transition-transform', servicesOpen && 'rotate-180')} />
                </button>
                <AnimatePresence>
                  {servicesOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full mt-1 w-56 rounded-xl border border-border bg-card/95 backdrop-blur-md p-2 shadow-xl"
                    >
                      {services.map((s) => (
                        <Link
                          key={s.href}
                          to={s.href}
                          className="block rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          {s.name}
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.name}
                </Link>
              ))}

              <div className="ml-4 flex items-center gap-3">
                <Link to="/auth">
                  <Button variant="ghost" size="sm" className="text-muted-foreground">
                    Sign In
                  </Button>
                </Link>
                <Link to="/custom-hats">
                  <Button
                    size="sm"
                    className="bg-[hsl(var(--warm))] text-[hsl(var(--warm-foreground))] hover:bg-[hsl(var(--warm))/0.9] font-semibold"
                  >
                    Get a Quote
                  </Button>
                </Link>
              </div>
            </nav>

            {/* Mobile menu button */}
            <button
              className="rounded-lg p-2 text-foreground lg:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-b border-border bg-background/95 backdrop-blur-md lg:hidden overflow-hidden"
            >
              <div className="space-y-1 px-4 pb-4 pt-2">
                <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Services
                </p>
                {services.map((s) => (
                  <Link
                    key={s.href}
                    to={s.href}
                    className="block rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    {s.name}
                  </Link>
                ))}
                <div className="my-2 border-t border-border" />
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="block rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    {link.name}
                  </Link>
                ))}
                <div className="my-2 border-t border-border" />
                <Link to="/auth">
                  <Button variant="outline" className="w-full mb-2">
                    Sign In
                  </Button>
                </Link>
                <Link to="/custom-hats">
                  <Button className="w-full bg-[hsl(var(--warm))] text-[hsl(var(--warm-foreground))] hover:bg-[hsl(var(--warm))/0.9]">
                    Get a Quote
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div className="lg:col-span-2">
              <h3 className="text-lg font-bold font-serif text-foreground">HELLS CANYON DESIGNS</h3>
              <p className="mt-3 max-w-md text-sm text-muted-foreground leading-relaxed">
                Premium custom branding from Lewiston, Idaho. Laser-engraved leather patches,
                embroidery, screen printing, and DTF transfers that make your brand unforgettable.
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                📍 Lewiston, Idaho &bull; Ships Nationwide
              </p>
            </div>

            {/* Services */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground">Services</h4>
              <ul className="mt-4 space-y-2">
                {services.map((s) => (
                  <li key={s.href}>
                    <Link to={s.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-foreground">Company</h4>
              <ul className="mt-4 space-y-2">
                <li>
                  <Link to="/about" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link to="/auth" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    Client Portal
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t border-border pt-8 text-center">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Hells Canyon Designs. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
