'use client';

import Link from 'next/link';
import { Fraunces, Manrope } from 'next/font/google';
import { useRef, useState } from 'react';
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import BerdeSprite from '@/components/BerdeSprite';

type ChipCategory = 'Food' | 'Transport' | 'Leisure';

type ChipSeed = {
  id: string;
  label: string;
  amount: string;
  category: ChipCategory;
  mobile: boolean;
  from: [number, number];
  chaos: [number, number];
  cluster: [number, number];
};

const displayFont = Fraunces({
  subsets: ['latin'],
  weight: ['600', '700'],
});

const bodyFont = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const CHIP_SEEDS: readonly ChipSeed[] = [
  {
    id: 'chip-gcash',
    label: 'GCash send',
    amount: '₱200',
    category: 'Leisure',
    mobile: true,
    from: [-340, -210],
    chaos: [-29, 108],
    cluster: [0, 180],
  },
  {
    id: 'chip-milktea',
    label: 'Milk tea',
    amount: '₱95',
    category: 'Food',
    mobile: true,
    from: [310, -240],
    chaos: [-504, -198],
    cluster: [-250, -130],
  },
  {
    id: 'chip-load',
    label: 'Load',
    amount: '₱50',
    category: 'Leisure',
    mobile: true,
    from: [-360, 190],
    chaos: [-403, 162],
    cluster: [-120, 200],
  },
  {
    id: 'chip-grab',
    label: 'Grab',
    amount: '₱180',
    category: 'Transport',
    mobile: true,
    from: [380, 120],
    chaos: [317, -252],
    cluster: [220, -130],
  },
  {
    id: 'chip-shopee',
    label: 'Shopee',
    amount: '₱340',
    category: 'Leisure',
    mobile: true,
    from: [120, 280],
    chaos: [72, 216],
    cluster: [120, 220],
  },
  {
    id: 'chip-ulam',
    label: 'Ulam',
    amount: '₱75',
    category: 'Food',
    mobile: true,
    from: [-190, 290],
    chaos: [-605, -45],
    cluster: [-280, -40],
  },
  {
    id: 'chip-cinema',
    label: 'Cinema',
    amount: '₱250',
    category: 'Leisure',
    mobile: false,
    from: [420, -150],
    chaos: [360, 90],
    cluster: [250, 190],
  },
  {
    id: 'chip-bills',
    label: 'Bills',
    amount: '₱1,200',
    category: 'Leisure',
    mobile: false,
    from: [-450, 40],
    chaos: [-216, 270],
    cluster: [-60, 240],
  },
  {
    id: 'chip-jeep',
    label: 'Jeep',
    amount: '₱25',
    category: 'Transport',
    mobile: false,
    from: [430, 260],
    chaos: [432, -72],
    cluster: [290, -20],
  },
  {
    id: 'chip-coffee',
    label: 'Coffee',
    amount: '₱140',
    category: 'Food',
    mobile: false,
    from: [-430, -260],
    chaos: [-173, -342],
    cluster: [-170, -200],
  },
];

function FogChip({ progress, chip }: { progress: MotionValue<number>; chip: ChipSeed }) {
  const x = useTransform(progress, [0, 0.24, 0.56, 0.78, 1], [chip.from[0], chip.chaos[0], chip.chaos[0], chip.cluster[0], chip.cluster[0]]);
  const y = useTransform(progress, [0, 0.24, 0.56, 0.78, 1], [chip.from[1], chip.chaos[1], chip.chaos[1], chip.cluster[1], chip.cluster[1]]);
  const opacity = useTransform(progress, [0, 0.1, 0.22, 1], [0, 0, 0.95, 1]);
  const scale = useTransform(progress, [0.2, 0.45, 1], [0.92, 1, 0.98]);
  const clarityTone = useTransform(progress, [0.5, 0.7, 1], [0.3, 0.75, 1]);

  return (
    <motion.div
      style={{ x, y, opacity, scale, borderColor: 'rgba(161,161,170,0.45)' }}
      className={`${chip.mobile ? 'flex' : 'hidden md:flex'} absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border bg-zinc-900/85 px-3 py-1.5 text-xs text-zinc-200 shadow-[0_18px_40px_-26px_rgba(0,0,0,0.75)] backdrop-blur`}
    >
      <motion.span style={{ opacity: clarityTone }} className="font-medium text-zinc-100">
        {chip.label}
      </motion.span>
      <span className="text-zinc-500">·</span>
      <motion.span style={{ opacity: clarityTone }} className="font-semibold text-emerald-300">
        {chip.amount}
      </motion.span>
    </motion.div>
  );
}

export default function LandingPage() {
  const [navSolid, setNavSolid] = useState(false);
  const fogSectionRef = useRef<HTMLElement | null>(null);

  const { scrollY } = useScroll();
  const { scrollYProgress: fogProgress } = useScroll({
    target: fogSectionRef,
    offset: ['start start', 'end end'],
  });

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setNavSolid(latest > 80);
  });

  const berdeChaosScale = useTransform(fogProgress, [0, 0.45, 1], [0.92, 1.06, 1.02]);
  const berdeWorriedOpacity = useTransform(fogProgress, [0.44, 0.58], [1, 0]);
  const berdeExcitedOpacity = useTransform(fogProgress, [0.52, 0.72], [0, 1]);
  const chaosLabelOpacity = useTransform(fogProgress, [0.1, 0.2, 0.62, 0.72], [0, 1, 1, 0]);
  const clarityLabelOpacity = useTransform(fogProgress, [0.56, 0.68, 1], [0, 1, 1]);
  const clusterLabelOpacity = useTransform(fogProgress, [0.55, 0.74], [0, 1]);

  return (
    <div
      className={`${bodyFont.className} relative min-h-screen overflow-x-clip text-zinc-100`}
      style={{ backgroundColor: '#09090b' }}
    >
      <motion.nav
        initial={false}
        animate={{
          backgroundColor: navSolid ? 'rgba(9, 9, 11, 0.82)' : 'rgba(9, 9, 11, 0)',
          borderColor: navSolid ? 'rgba(39, 39, 42, 0.7)' : 'rgba(39, 39, 42, 0)',
        }}
        className="fixed inset-x-0 top-0 z-50 border-b backdrop-blur-xl transition-colors"
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="text-lg font-semibold tracking-tight text-[#1D9E75]">
            Moneda
          </Link>

          <div className="flex items-center gap-2.5">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/onboarding"
              className="rounded-full bg-[#1D9E75] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#188361]"
            >
              Get started
            </Link>
          </div>
        </div>
      </motion.nav>

      <main>
        <section
          className="relative flex min-h-screen items-center justify-center px-5 pb-16 pt-28 text-center"
          style={{ backgroundColor: '#09090b' }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_40%_at_50%_42%,rgba(29,158,117,0.08),transparent_80%)]"
          />

          <div className="relative mx-auto max-w-3xl">
            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className={`${displayFont.className} text-[clamp(2.8rem,8vw,5.15rem)] font-semibold tracking-tight text-white`}
            >
              Payday.
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className={`${displayFont.className} mt-3 text-[clamp(2.8rem,8vw,5.15rem)] font-semibold tracking-tight text-zinc-400`}
            >
              Gone again.
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1 }}
              className="mx-auto mt-9 max-w-[30rem] text-sm leading-relaxed text-zinc-500 sm:text-base"
            >
              You&apos;re not bad with money. You just can&apos;t see where it goes.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.4 }}
            className="pointer-events-none absolute bottom-8 right-16 z-10"
          >
            <BerdeSprite size={56} state="worried" animated />
          </motion.div>

          <motion.div
            aria-hidden
            animate={{ y: [0, 8, 0], opacity: [0.45, 1, 0.45] }}
            transition={{ duration: 1.8, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 text-zinc-500"
          >
            <ChevronDown size={22} />
          </motion.div>
        </section>

        <section
          ref={fogSectionRef}
          className="relative min-h-[240vh]"
          style={{ backgroundColor: '#09090b' }}
        >
          <div className="relative sticky top-0 h-screen overflow-hidden">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(48%_52%_at_50%_48%,rgba(29,158,117,0.18),transparent_76%)]"
            />

            {CHIP_SEEDS.map((chip) => (
              <FogChip key={chip.id} progress={fogProgress} chip={chip} />
            ))}

            <motion.p
              style={{ opacity: chaosLabelOpacity }}
              className="absolute left-1/2 top-[18%] -translate-x-1/2 text-center text-xl font-semibold text-zinc-100 sm:text-2xl"
            >
              There&apos;s a pattern here.
            </motion.p>

            <motion.p
              style={{ opacity: clarityLabelOpacity }}
              className="absolute left-1/2 top-[18%] -translate-x-1/2 text-center text-xl font-semibold text-zinc-100 sm:text-2xl"
            >
              Your money has a story.
            </motion.p>

            <motion.p
              style={{ opacity: clusterLabelOpacity }}
              className="absolute left-[16%] top-[18%] rounded-full border border-emerald-500/35 bg-zinc-900/70 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-emerald-300"
            >
              FOOD
            </motion.p>
            <motion.p
              style={{ opacity: clusterLabelOpacity }}
              className="absolute right-[12%] top-[18%] rounded-full border border-teal-500/35 bg-zinc-900/70 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-teal-200"
            >
              TRANSPORT
            </motion.p>
            <motion.p
              style={{ opacity: clusterLabelOpacity }}
              className="absolute bottom-[20%] left-1/2 -translate-x-1/2 rounded-full border border-zinc-500/35 bg-zinc-900/70 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-zinc-300"
            >
              LEISURE / OTHER
            </motion.p>

            <motion.div
              style={{ scale: berdeChaosScale }}
              className="absolute left-1/2 top-[54%] h-[88px] w-[88px] -translate-x-1/2 -translate-y-1/2 sm:left-[44%]"
            >
              <motion.div style={{ opacity: berdeWorriedOpacity }} className="absolute left-0 top-0">
                <BerdeSprite size={88} state="worried" animated />
              </motion.div>
              <motion.div style={{ opacity: berdeExcitedOpacity }} className="absolute left-0 top-0">
                <BerdeSprite size={88} state="excited" animated />
              </motion.div>
            </motion.div>
          </div>
        </section>

        <section className="snap-y snap-mandatory bg-zinc-100 text-zinc-900">
          <section className="snap-start">
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.65 }}
              className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:px-8"
            >
              <div className="text-left">
                <h2 className={`${displayFont.className} text-4xl leading-tight text-zinc-900 sm:text-5xl`}>
                  Budget without shame.
                </h2>
                <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-600 sm:text-lg">
                  Moneda doesn&apos;t punish you for overspending. It gives you context so next month goes better.
                </p>
              </div>

              <div className="relative mx-auto w-full max-w-xl">
                <div className="relative rounded-3xl border border-zinc-200 bg-white p-6 shadow-[0_30px_60px_-40px_rgba(0,0,0,0.35)]">
                  <p className="text-sm font-semibold text-zinc-700">Food · ₱2,400 / ₱3,000</p>
                  <div className="mt-3 h-3 rounded-full bg-zinc-200">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: '80%' }}
                      viewport={{ once: true, amount: 0.6 }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full rounded-full bg-[#1D9E75]"
                    />
                  </div>
                  <p className="mt-3 text-sm text-zinc-500">₱600 left.</p>
                </div>

                <div className="mt-4 flex justify-center sm:justify-start">
                  <BerdeSprite size={60} state="neutral" animated={false} />
                </div>
              </div>
            </motion.div>
          </section>

          <section className="snap-start bg-zinc-50">
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.65 }}
              className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:px-8"
            >
              <div className="order-2 md:order-1">
                <div className="relative rounded-3xl border border-zinc-200 bg-white p-6 shadow-[0_30px_60px_-40px_rgba(0,0,0,0.35)]">
                  <div className="ml-auto mb-3 max-w-[18rem] rounded-2xl bg-[#1D9E75] px-4 py-3 text-sm font-medium text-white">
                    Nagbayad ng rent, ₱4,500
                  </div>
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ delay: 0.25, duration: 0.5 }}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700"
                  >
                    <p className="font-semibold text-zinc-800">Rent · ₱4,500 · Just now</p>
                  </motion.div>
                </div>
                <div className="mt-4 flex justify-center sm:justify-start">
                  <BerdeSprite size={58} state="excited" />
                </div>
              </div>

              <div className="order-1 md:order-2">
                <h2 className={`${displayFont.className} text-4xl leading-tight text-zinc-900 sm:text-5xl`}>
                  I-type lang. Bahala na si Berde.
                </h2>
                <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-600 sm:text-lg">
                  Sabihin mo lang kung ano ang ginastos mo. Itatala ni Berde lahat — kategoria, halaga, at lahat ng detalye.
                </p>
              </div>
            </motion.div>
          </section>

          <section className="snap-start bg-zinc-100">
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.65 }}
              className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center px-5 py-16 text-center md:px-8"
            >
              <h2 className={`${displayFont.className} text-4xl leading-tight text-zinc-900 sm:text-5xl`}>
                Every little bit counts.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-600 sm:text-lg">
                You don&apos;t need to save big. You just need a direction.
              </p>

              <div className="relative mt-10 h-[140px] w-[160px] overflow-hidden rounded-[40px] border-4 border-zinc-300 bg-white/95 shadow-inner">
                <motion.div
                  initial={{ height: '0%' }}
                  whileInView={{ height: '60%' }}
                  viewport={{ once: true, amount: 0.65 }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className="absolute inset-x-0 bottom-0 bg-emerald-200"
                />
                <div className="absolute inset-0 flex items-center justify-center text-7xl">🫙</div>
              </div>
              <p className="mt-4 text-sm font-medium text-zinc-600">Emergency Fund · ₱3,200 / ₱5,000</p>

              <div className="mt-5">
                <BerdeSprite size={70} state="excited" />
              </div>
            </motion.div>
          </section>
        </section>

        <section
          className="flex min-h-screen items-center justify-center px-5 py-24 text-center"
          style={{ backgroundColor: '#09090b' }}
        >
          <div className="mx-auto max-w-3xl">
            <motion.p
              initial={{ opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.55, delay: 0 }}
              className={`${displayFont.className} text-4xl leading-tight text-white sm:text-5xl`}
            >
              This isn&apos;t about changing overnight.
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.55, delay: 0.2 }}
              className={`${displayFont.className} mt-4 text-4xl leading-tight text-zinc-300 sm:text-5xl`}
            >
              It&apos;s about finally seeing where your money goes.
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.55, delay: 0.4 }}
              className={`${displayFont.className} mt-8 text-3xl text-[#1D9E75] sm:text-4xl`}
            >
              Clarity, not guilt.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.55 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="mt-8 flex justify-center"
            >
              <BerdeSprite size={80} state="excited" />
            </motion.div>
          </div>
        </section>

        <section className="flex min-h-[82vh] items-center justify-center bg-zinc-50 px-5 py-16 text-center text-zinc-900 md:min-h-screen md:py-20">
          <div className="mx-auto max-w-2xl">
            <h2 className={`${displayFont.className} text-6xl font-semibold leading-[0.95] tracking-tight text-zinc-900 sm:text-7xl`}>
              Ready to see it?
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base text-zinc-500 sm:text-lg">
              Free. No setup required. Start today.
            </p>

            <div className="mt-10 flex flex-col items-center gap-4">
              <Link
                href="/onboarding"
                className="inline-flex items-center justify-center rounded-full bg-[#1D9E75] px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-[#188361] sm:text-lg"
              >
                Use on this device →
              </Link>

              <Link href="/login" className="text-sm text-zinc-400 transition-colors hover:text-zinc-600">
                Already have an account? Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
