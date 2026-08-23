import { motion } from "motion/react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import {
  ShoppingCart,
  Wallet,
  Users,
  Ticket,
  Shield,
  Headphones,
  Zap,
  Wifi,
  ChevronDown,
  ChevronUp,
  Check,
  Crown,
  ArrowRight,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { formatNaira } from "@/lib/plans.ts";
import { WHATSAPP_GROUP_URL } from "@/lib/whatsapp.ts";
import WhatsAppIcon from "@/components/whatsapp-icon.tsx";
import { api, useConvexAuth, useMutation, useQuery } from "@/lib/pconnect-api.ts";
import { useSiteAsset, useSiteName } from "@/lib/site-settings.ts";
import { getRegistrationUrl } from "@/lib/auth-redirect.ts";

const DEFAULT_HERO_URL = "https://hercules-cdn.com/file_N4vw0dKasw7kaIkScQbfJFXL";
const DEFAULT_COMMUNITY_URL = "https://hercules-cdn.com/file_qfPEDBMPY2Zu03ym6A5vlo1C";

const STATS = [
  { icon: Users, value: "25,000+", label: "Happy Users" },
  { icon: Ticket, value: "120K+", label: "Vouchers Sold" },
  { icon: Shield, value: "99.9%", label: "Uptime" },
  { icon: Headphones, value: "24/7", label: "Customer Support" },
];

const PLAN_ICONS = [Zap, Wifi, Crown, Wifi];

type HomePlan = {
  _id: string;
  name: string;
  durationLabel: string;
  price: number;
  popular: boolean;
  availableCount: number;
  features?: { icon: string; text: string }[] | null;
};

type PurchaseResult = {
  username: string;
  password: string;
  planName: string;
};

const BENEFITS = [
  { icon: Zap, title: "Instant Delivery", desc: "Get your voucher instantly after payment" },
  { icon: Shield, title: "Secure Payment", desc: "Safe and secure payments with Flutterwave" },
  { icon: Wifi, title: "Reliable Connection", desc: "High-speed internet you can count on" },
  { icon: Headphones, title: "24/7 Support", desc: "We are here to help anytime you need us" },
];

const HOW_IT_WORKS = [
  { step: "1", icon: Users, title: "Create Account", desc: "Sign up in seconds with your email and phone number." },
  { step: "2", icon: Wallet, title: "Fund Your Wallet", desc: "Add funds securely using Flutterwave payment gateway." },
  { step: "3", icon: Wifi, title: "Buy & Connect", desc: "Choose your plan, buy instantly, and get online!" },
];

const FAQS = [
  { q: "How do I buy a voucher?", a: "Register for an account, fund your wallet using Flutterwave, then browse plans and click Buy Now. Your voucher credentials will be delivered instantly." },
  { q: "How long does it take to receive my voucher?", a: "Vouchers are delivered instantly after a successful wallet deduction. You can view your credentials immediately in My Vouchers." },
  { q: "What payment methods are supported?", a: "We accept payments via Flutterwave which supports cards, bank transfers, USSD, and mobile money." },
  { q: "Can I use a voucher on multiple devices?", a: "Each voucher is tied to a single MikroTik session. Check your plan details for device and data limits." },
  { q: "What if my voucher doesn't work?", a: "Contact our support team via WhatsApp and we will resolve it promptly, usually within minutes." },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="cursor-pointer overflow-hidden rounded-2xl border border-[#7519e9]/25 bg-[#23103e]/60" onClick={() => setOpen(!open)}>
      <div className="flex items-center justify-between p-5">
        <span className="pr-4 text-sm leading-snug font-semibold text-white">{q}</span>
        {open ? <ChevronUp size={18} className="shrink-0 text-purple-400" /> : <ChevronDown size={18} className="shrink-0 text-white/50" />}
      </div>
      {open && <div className="px-5 pb-5 text-sm leading-relaxed text-white/70">{a}</div>}
    </div>
  );
}

export default function Index() {
  const navigate = useNavigate();
  const { isAuthenticated } = useConvexAuth();
  const siteName = useSiteName();
  const heroUrl = useSiteAsset("hero_banner", DEFAULT_HERO_URL);
  const communityUrl = useSiteAsset("community_banner", DEFAULT_COMMUNITY_URL);
  const plans = useQuery<HomePlan[]>(api.voucherPlans.listActivePlans, {});
  const purchaseVoucher = useMutation(api.vouchers.purchaseVoucher);
  const [buyingPlan, setBuyingPlan] = useState<string | null>(null);
  const [purchaseResult, setPurchaseResult] = useState<PurchaseResult | null>(null);
  const buyVouchersUrl = isAuthenticated ? "/plans" : getRegistrationUrl("/plans");
  const fundWalletUrl = isAuthenticated ? "/wallet" : getRegistrationUrl("/wallet");

  const handleBuy = async (plan: HomePlan) => {
    if (!isAuthenticated) {
      navigate(getRegistrationUrl("/plans"));
      return;
    }
    setBuyingPlan(plan._id);
    try {
      const result = await purchaseVoucher({ planId: plan._id });
      setPurchaseResult(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Purchase failed. Please try again.");
    } finally {
      setBuyingPlan(null);
    }
  };

  return (
    <div className="bg-[#10051f]">
      <section className="relative flex min-h-[60vh] items-center justify-center overflow-hidden md:min-h-[80vh]">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroUrl})` }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(16,5,31,0.75) 0%, rgba(16,5,31,0.5) 50%, rgba(16,5,31,0.95) 100%)" }} />
        <div className="pointer-events-none absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-[#7519e9]/20 blur-3xl" />
        <div className="pointer-events-none absolute right-1/4 bottom-1/4 h-64 w-64 rounded-full bg-[#ff2549]/15 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-7xl px-4 pt-12 pb-12 text-center md:pt-24 md:pb-16 md:text-left">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: "easeOut" as const }}>
            <h1 className="text-4xl leading-tight font-extrabold text-balance text-white sm:text-5xl md:text-6xl">
              Fast Internet{" "}
              <span className="bg-gradient-to-r from-[#df20ba] to-[#ff2549] bg-clip-text text-transparent">Starts Here</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg md:mx-0">
              Buy your WiFi access pass instantly and stay connected with high speed internet.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row md:justify-start">
              <Button asChild size="lg" variant="glossy" className="w-full text-base font-bold sm:w-auto">
                <Link to={buyVouchersUrl}><ShoppingCart size={18} /> Buy Vouchers Now</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="w-full border border-white/20 text-base font-semibold text-white hover:bg-white/5 sm:w-auto">
                <Link to={fundWalletUrl}><Wallet size={18} /> Fund Wallet</Link>
              </Button>
            </div>
            <a href={WHATSAPP_GROUP_URL} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex cursor-pointer items-center gap-2 text-sm text-white/80 transition-colors hover:text-white">
              <WhatsAppIcon className="size-6 shrink-0" />
              Join our WhatsApp community
              <ArrowRight size={14} className="text-purple-400" />
            </a>
          </motion.div>
        </div>
      </section>

      <section className="relative z-10 -mt-16 px-4 pb-8">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
          className="mx-auto grid max-w-7xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-[#7519e9]/30 bg-[#23103e]/80 backdrop-blur-xl md:grid-cols-4">
          {STATS.map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex items-center gap-3 border-r border-[#7519e9]/15 px-5 py-5 last:border-r-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#7519e9]/20"><Icon size={18} className="text-purple-400" /></div>
              <div><div className="text-lg leading-tight font-bold text-white">{value}</div><div className="text-xs text-white/50">{label}</div></div>
            </div>
          ))}
        </motion.div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-2 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white md:text-3xl">Popular{" "}<span className="bg-gradient-to-r from-[#7519e9] to-[#df20ba] bg-clip-text text-transparent">Voucher Plans</span></h2>
              <p className="mt-1 text-sm text-white/50">Affordable plans for everyone. Choose and connect instantly.</p>
            </div>
            <Button asChild variant="ghost" className="hidden gap-1 border border-white/15 text-sm text-white/70 hover:bg-white/5 hover:text-white md:flex">
              <Link to="/plans">View All Plans <ArrowRight size={14} /></Link>
            </Button>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(plans ?? []).slice(0, 4).map((plan, i) => {
              const Icon = PLAN_ICONS[i % PLAN_ICONS.length];
              return (
                <motion.div key={plan._id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.4 }}
                  className={plan.popular ? "relative flex flex-col rounded-2xl border border-[#df20ba]/50 bg-gradient-to-br from-[#7519e9]/35 to-[#df20ba]/20 p-5 shadow-[0_0_30px_rgba(223,32,186,0.2)]" : "relative flex flex-col rounded-2xl border border-[#7519e9]/25 bg-[#23103e]/60 p-5"}>
                  {plan.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#7519e9] to-[#ff2549] px-4 py-1 text-xs font-bold text-white">Most Popular</div>}
                  <div className="mb-4 flex items-center justify-between">
                    <div><div className="text-base font-bold text-white">{plan.name}</div><div className="mt-0.5 text-xs text-white/50">{plan.durationLabel}</div></div>
                    <div className={plan.popular ? "flex h-10 w-10 items-center justify-center rounded-xl bg-[#df20ba]/20" : "flex h-10 w-10 items-center justify-center rounded-xl bg-[#7519e9]/15"}>
                      <Icon size={18} className={plan.popular ? "text-pink-400" : "text-purple-400"} />
                    </div>
                  </div>
                  <div className="mb-4 text-3xl font-extrabold text-white">{formatNaira(plan.price)}</div>
                  <ul className="mb-6 flex flex-1 flex-col gap-1.5">
                    {(plan.features ?? []).map((feature, featureIndex) => (<li key={`${feature.text}-${featureIndex}`} className="flex items-center gap-2 text-sm text-white/70"><Check size={14} className="shrink-0 text-green-400" />{feature.text}</li>))}
                  </ul>
                  <Button
                    className="w-full font-bold"
                    variant={plan.popular ? "glossy" : "secondary"}
                    disabled={buyingPlan === plan._id || plan.availableCount === 0}
                    onClick={() => void handleBuy(plan)}
                  >
                    {buyingPlan === plan._id ? "Processing…" : plan.availableCount === 0 ? "Out of Stock" : isAuthenticated ? "Buy Now" : "Sign In to Buy"}
                  </Button>
                  {purchaseResult?.planName === plan.name && (
                    <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-white/80">
                      <div className="font-semibold text-emerald-300">Voucher purchased</div>
                      <div className="mt-1 font-mono">Username: {purchaseResult.username}</div>
                      <div className="font-mono">Password: {purchaseResult.password}</div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
          <div className="mt-6 text-center md:hidden">
            <Button asChild variant="ghost" className="gap-1 border border-white/15 text-sm text-white/70"><Link to="/plans">View All Plans <ArrowRight size={14} /></Link></Button>
          </div>
        </div>
      </section>

      <section className="bg-[#23103e]/30 px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-2 text-center text-2xl font-bold text-white md:text-3xl">Why Choose{" "}<span className="bg-gradient-to-r from-[#7519e9] to-[#df20ba] bg-clip-text text-transparent">{siteName}?</span></h2>
          <p className="mb-10 text-center text-sm text-white/50">Everything you need for seamless internet connectivity</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map(({ icon: Icon, title, desc }, i) => (
              <motion.div key={title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="rounded-2xl border border-[#7519e9]/20 bg-[#23103e]/60 p-6 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#7519e9]/20"><Icon size={22} className="text-purple-400" /></div>
                <h3 className="mb-2 text-base font-bold text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-white/55">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#23103e]/30 px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-2 text-center text-2xl font-bold text-white md:text-3xl">How It{" "}<span className="bg-gradient-to-r from-[#7519e9] to-[#df20ba] bg-clip-text text-transparent">Works</span></h2>
          <p className="mb-10 text-center text-sm text-white/50">Get connected in just 3 simple steps</p>
          <div className="flex flex-col gap-6 md:flex-row">
            {HOW_IT_WORKS.map(({ step, icon: Icon, title, desc }) => (
              <motion.div key={step} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                className="relative flex-1 rounded-2xl border border-[#7519e9]/25 bg-[#23103e]/60 p-6 text-center">
                <div className="absolute -top-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-br from-[#7519e9] to-[#ff2549] text-sm font-bold text-white">{step}</div>
                <div className="mx-auto mt-3 mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#7519e9]/20"><Icon size={20} className="text-purple-400" /></div>
                <h3 className="mb-1 text-base font-bold text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-white/55">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl border border-[#df20ba]/30">
            {/* Background photo */}
            <img
              src={communityUrl}
              alt={`${siteName} community`}
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
            {/* Gradient overlay with glass effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#7519e9]/50 via-[#b20ed2]/40 to-[#ff2549]/35" />
            {/* Glassy inner surface */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/40" />
            {/* Content */}
            <div className="relative p-8">
              <Globe size={48} className="mx-auto mb-4 text-white drop-shadow-lg" />
              <h2 className="mb-2 text-2xl font-bold text-white drop-shadow">Join Our Community</h2>
              <p className="mb-6 text-sm text-white/80 drop-shadow">Connect with thousands of happy users, get tips, and stay updated on new plans.</p>
              <motion.a
                href={WHATSAPP_GROUP_URL}
                target="_blank"
                rel="noreferrer"
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.97 }}
                animate={{ boxShadow: ["0 0 0px rgba(37,211,102,0)", "0 0 22px rgba(37,211,102,0.7)", "0 0 0px rgba(37,211,102,0)"] }}
                transition={{ boxShadow: { duration: 2, repeat: Infinity, ease: "easeInOut" } }}
                 className="inline-flex items-center gap-2 rounded-lg bg-[#25d366] px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-[#22c55e] cursor-pointer"
              >
                 <img src="/whatsapp-logo.svg" alt="" className="size-5 shrink-0 rounded-full" />
                Join WhatsApp Group
              </motion.a>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-2 text-center text-2xl font-bold text-white md:text-3xl">Frequently Asked{" "}<span className="bg-gradient-to-r from-[#7519e9] to-[#df20ba] bg-clip-text text-transparent">Questions</span></h2>
          <p className="mb-10 text-center text-sm text-white/50">Everything you need to know</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {FAQS.map((faq) => (<FaqItem key={faq.q} q={faq.q} a={faq.a} />))}
          </div>
        </div>
      </section>
    </div>
  );
}
