import { Link } from "react-router-dom";
import { Construction } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";

export default function ComingSoon() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#7519e9]/20">
        <Construction size={36} className="text-purple-400" />
      </div>
      <h1 className="text-2xl font-bold text-white">Coming Soon</h1>
      <p className="text-sm text-white/50 max-w-sm">This page is under construction. Check back soon for updates!</p>
      <Button asChild variant="glossy"><Link to="/">Go Home</Link></Button>
    </div>
  );
}
