import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import Logo from "@/components/logo.tsx";
import { WHATSAPP_GROUP_URL } from "@/lib/whatsapp.ts";

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#0c0316] px-4 py-12 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">Fast, reliable MikroTik Wi-Fi vouchers. Buy instantly, connect anywhere, anytime.</p>
            <a href={WHATSAPP_GROUP_URL} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#25D366] hover:underline">
              <MessageCircle className="size-4" />Join our WhatsApp community
            </a>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Company</h4>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/" className="hover:text-foreground">Home</Link></li>
              <li><Link to="/plans" className="hover:text-foreground">Voucher Plans</Link></li>
              <li><Link to="/how-it-works" className="hover:text-foreground">How It Works</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Account</h4>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/dashboard" className="hover:text-foreground">Dashboard</Link></li>
              <li><Link to="/wallet" className="hover:text-foreground">Wallet</Link></li>
              <li><Link to="/my-vouchers" className="hover:text-foreground">My Vouchers</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">Support</h4>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li><Link to="/support" className="hover:text-foreground">Help &amp; FAQ</Link></li>
              <li><Link to="/support" className="hover:text-foreground">Contact Us</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-muted-foreground">&copy; 2026 <a href="https://pcyberict.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground underline underline-offset-2">PCYBER ICT SERVICES</a>. All rights reserved.</div>
      </div>
    </footer>
  );
}
