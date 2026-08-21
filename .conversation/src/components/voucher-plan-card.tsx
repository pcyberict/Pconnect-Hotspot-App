import { Link } from "react-router-dom";
import { Crown, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { formatNaira, type VoucherPlan } from "@/lib/plans.ts";
import { FeatureIcon } from "@/pages/admin/AdminPlans.tsx";
import { cn } from "@/lib/utils.ts";

export default function VoucherPlanCard({ plan }: { plan: VoucherPlan }) {
  return (
    <div className={cn("relative flex flex-col rounded-2xl border border-white/10 bg-[linear-gradient(160deg,rgba(117,25,233,0.18),rgba(255,37,73,0.08))] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-transform hover:-translate-y-1", plan.popular && "border-[#df20ba]/60 ring-1 ring-[#df20ba]/40")}>
      {plan.popular && (
        <span className="absolute -top-3 left-4 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#b20ed2] to-[#ff2549] px-3 py-1 text-xs font-semibold text-white shadow-[0_0_12px_rgba(178,14,210,0.6)]">
          <Crown className="size-3" /> Most Popular
        </span>
      )}
      <div className="mt-2">
        <h3 className="text-lg font-semibold">{plan.name}</h3>
        <p className="text-xs text-muted-foreground">{plan.durationLabel}</p>
      </div>
      <div className="mt-4 text-3xl font-bold tracking-tight">{formatNaira(plan.price)}</div>
      <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
        {plan.richFeatures && plan.richFeatures.length > 0
          ? plan.richFeatures.map((feature, i) => (
              <li key={i} className="flex items-center gap-2">
                <FeatureIcon iconKey={feature.icon} size={15} />
                {feature.text}
              </li>
            ))
          : plan.features.map((feature) => (
              <li key={feature} className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-[#df20ba] shrink-0" />
                {feature}
              </li>
            ))}
      </ul>
      <Button asChild variant="glossy" className="mt-5 w-full">
        <Link to="/plans">Buy Now</Link>
      </Button>
    </div>
  );
}
