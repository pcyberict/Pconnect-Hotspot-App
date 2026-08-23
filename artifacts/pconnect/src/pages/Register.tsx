import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Register is handled by the Login page via the "register" tab
export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    query.set("tab", "register");
    void navigate(`/login?${query.toString()}#register`, { replace: true });
  }, [location.search, navigate]);
  return null;
}
