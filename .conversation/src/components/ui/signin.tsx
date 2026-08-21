import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button.tsx";

export function SignInButton() {
  return (
    <Button asChild variant="secondary">
      <Link to="/login">Sign In</Link>
    </Button>
  );
}