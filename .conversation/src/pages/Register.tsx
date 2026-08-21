import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Register is handled by the Login page via the "register" tab
export default function Register() {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate("/login?tab=register", { replace: true });
  }, [navigate]);
  return null;
}
