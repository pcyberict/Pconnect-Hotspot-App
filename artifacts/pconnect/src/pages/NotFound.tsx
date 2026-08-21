import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-6xl font-extrabold text-white/20">404</h1>
      <h2 className="text-2xl font-bold text-white">Page Not Found</h2>
      <p className="text-sm text-white/50">The page you are looking for does not exist.</p>
      <Button asChild variant="glossy"><Link to="/">Go Home</Link></Button>
    </div>
  );
}
