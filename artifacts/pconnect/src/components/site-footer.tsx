import { Link } from "react-router-dom";
import { Heart, MessageCircle } from "lucide-react";
import Logo from "@/components/logo.tsx";
import { useSiteName, useWhatsAppGroupUrl } from "@/lib/site-settings.ts";

export default function SiteFooter() {
  const siteName = useSiteName();
  const whatsappGroupUrl = useWhatsAppGroupUrl();

  return (
    <footer className="mt-auto w-full shrink-0 border-t border-white/10 bg-[#0c0316] px-4 py-5 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-start gap-6 md:grid-cols-[1.35fr_repeat(3,minmax(0,1fr))] md:gap-8">
          <div className="-mt-2 flex min-w-0 flex-col items-start md:-mt-10">
            <Logo variant="footer" className="leading-none" />
            <p className="-mt-2 max-w-xs text-sm leading-5 text-muted-foreground">Fast, reliable {siteName} Wi-Fi vouchers. Buy instantly, connect anywhere, anytime.</p>
            <a href={whatsappGroupUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-2 text-sm font-medium leading-5 text-[#25D366] hover:underline">
              <MessageCircle className="size-4" />Join our WhatsApp community
            </a>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Company</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/" className="hover:text-foreground">Home</Link></li>
              <li><Link to="/plans" className="hover:text-foreground">Voucher Plans</Link></li>
              <li><Link to="/how-it-works" className="hover:text-foreground">How It Works</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Account</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/dashboard" className="hover:text-foreground">Dashboard</Link></li>
              <li><Link to="/wallet" className="hover:text-foreground">Wallet</Link></li>
              <li><Link to="/my-vouchers" className="hover:text-foreground">My Vouchers</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Support</h4>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/support" className="hover:text-foreground">Help &amp; FAQ</Link></li>
              <li><Link to="/support" className="hover:text-foreground">Contact Us</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-6 border-t border-white/10 pt-3 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} <a href="https://pcyberict.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-emerald-400 no-underline hover:text-emerald-300">
            <Heart className="size-3 animate-pulse fill-emerald-400" aria-hidden="true" />PCYBER ICT SERVICES
          </a>. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
