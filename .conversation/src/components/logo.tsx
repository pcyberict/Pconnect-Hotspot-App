import { cn } from "@/lib/utils.ts";

export default function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center", className)}>
      <img
        src="https://hercules-cdn.com/file_PDusWTTXoxwuVrGaJFbrGp0y"
        alt="PCONNECT"
        className="w-40 mix-blend-screen md:w-56"
        style={{ height: "auto" }}
      />
    </div>
  );
}
