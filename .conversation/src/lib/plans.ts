export type VoucherPlan = {
  id: string;
  name: string;
  durationLabel: string;
  price: number;
  popular?: boolean;
  features: string[];
  richFeatures?: { icon: string; text: string }[];
};

export const PLACEHOLDER_PLANS: VoucherPlan[] = [
  { id: "1-day", name: "1 Day Pass", durationLabel: "24 Hours Access", price: 200, features: ["High Speed", "Full Access", "24/7 Support"] },
  { id: "3-day", name: "3 Days Pass", durationLabel: "72 Hours Access", price: 500, features: ["High Speed", "Full Access", "24/7 Support"] },
  { id: "7-day", name: "7 Days Pass", durationLabel: "168 Hours Access", price: 1000, popular: true, features: ["High Speed", "Full Access", "24/7 Support"] },
  { id: "30-day", name: "30 Days Pass", durationLabel: "720 Hours Access", price: 3000, features: ["High Speed", "Full Access", "24/7 Support"] },
];

export function formatNaira(amount: number) {
  return `\u20a6${amount.toLocaleString("en-NG")}`;
}
