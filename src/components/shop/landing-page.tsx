"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Bot, Layers3, Sparkles } from "lucide-react";
import { brandConfig } from "@/lib/brand/config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteLogo } from "@/components/shared/site-logo";

const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const featureItems = [
  {
    icon: Sparkles,
    title: "KI-Logo-Platzierung",
    description: "Upload einmal, automatisch auf allen Produkten.",
  },
  {
    icon: Bot,
    title: "Moodboard-Generator",
    description: "Branchenspezifische Produkt-Szenarien in Sekunden.",
  },
  {
    icon: Layers3,
    title: "Alle Lieferanten, ein Shop",
    description: "Stricker, PF Concept und Makito auf einer Plattform.",
  },
];

const categories = [
  { label: "Taschen", href: "/shop?category=taschen", style: "bg-accent-100" },
  { label: "Tassen", href: "/shop?category=tassen", style: "bg-brand-100" },
  { label: "Flaschen", href: "/shop?category=flaschen", style: "bg-accent-100" },
  { label: "Rucksäcke", href: "/shop?category=rucksaecke", style: "bg-brand-100" },
];

export function LandingPage() {
  return (
    <main className="bg-background text-foreground">
      <section
        className="min-h-screen"
        style={{ background: "var(--hero-gradient)" }}
      >
        <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 sm:px-8 lg:px-12">
          <header className="flex items-center justify-between">
            <SiteLogo className="text-white [&_span:last-child]:text-white" />
            <Button asChild variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white">
              <Link href="/login">Login</Link>
            </Button>
          </header>

          <motion.div
            className="my-auto max-w-3xl space-y-7 py-10"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.1 } },
            }}
          >
            <motion.p variants={fadeInUp}>
              <Badge className="bg-white/10 text-white">B2B Werbemittel Shop</Badge>
            </motion.p>
            <motion.h1
              variants={fadeInUp}
              className="text-5xl leading-tight font-semibold text-white sm:text-6xl"
            >
              Werbemittel, die{" "}
              <span className="font-serif italic text-accent-200">bleiben</span>.
            </motion.h1>
            <motion.p
              variants={fadeInUp}
              className="max-w-2xl text-lg leading-relaxed text-zinc-200"
            >
              Branded merchandise mit KI-Logo-Platzierung und Moodboards. Ein
              Shop für alle Ihre Lieferanten.
            </motion.p>
            <motion.div variants={fadeInUp} className="flex flex-wrap gap-3">
              <Button asChild variant="accent" size="lg">
                <Link href="/register">Jetzt registrieren</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/login">Login</Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 py-20 sm:px-8 lg:px-12">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeInUp}
          className="mb-10"
        >
          <h2 className="text-3xl font-semibold">
            Drei KI-Features, die unseren Shop einzigartig machen
          </h2>
        </motion.div>
        <div className="grid gap-4 md:grid-cols-3">
          {featureItems.map((feature, idx) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ delay: idx * 0.1, duration: 0.4 }}
            >
              <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)]">
                <CardHeader className="pb-2">
                  <feature.icon className="size-5 text-brand-600" />
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground">
                  {feature.description}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-6 pb-20 sm:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          className="mb-8"
        >
          <h2 className="text-3xl font-semibold">Kategorien</h2>
        </motion.div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category, idx) => (
            <motion.div
              key={category.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ delay: idx * 0.06 }}
            >
              <Link
                href={category.href}
                className={`group block overflow-hidden rounded-[var(--radius)] border border-border ${category.style} p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)]`}
              >
                <div className="mb-8 aspect-[4/3] rounded-xl bg-white/45" />
                <p className="text-lg font-medium">{category.label}</p>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-surface/70">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-5 px-6 py-8 text-sm text-muted-foreground sm:px-8 lg:px-12">
          <span className="font-medium text-foreground">Powered by</span>
          {["Stricker", "PF Concept", "Makito"].map((name) => (
            <span
              key={name}
              className="rounded-md border border-border bg-muted px-3 py-2"
            >
              {name}
            </span>
          ))}
        </div>
      </section>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-6 py-12 sm:px-8 md:grid-cols-3 lg:px-12">
          <div className="space-y-3">
            <h3 className="font-semibold">Unternehmen</h3>
            <p className="text-sm text-muted-foreground">
              {brandConfig.legal_name}
              <br />
              {brandConfig.address.street}
              <br />
              {brandConfig.address.zip} {brandConfig.address.city}
            </p>
          </div>
          <div className="space-y-3">
            <h3 className="font-semibold">Rechtliches</h3>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link href="/impressum" className="hover:text-foreground">
                Impressum
              </Link>
              <Link href="/agb" className="hover:text-foreground">
                AGB
              </Link>
              <Link href="/datenschutz" className="hover:text-foreground">
                Datenschutz
              </Link>
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="font-semibold">Kontakt</h3>
            <p className="text-sm text-muted-foreground">
              Vertrieb und Beratung:
              <br />
              hallo@example.com
              <br />
              +49 30 1234567
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
