"use client";
import { usePathname } from "next/navigation";

// Pages that keep their own design (the sign-in pages); everything else gets the admin-style soft UI
const OWN_DESIGN = ["/globe/login", "/globe/forgot-password", "/globe/reset-password"];

export default function GlobeThemeShell({ children }) {
  const pathname = usePathname() || "";
  const ownDesign = OWN_DESIGN.some((p) => pathname.startsWith(p));
  return (
    <div className={`globe-portal-theme${ownDesign ? "" : " admin-neu globe-neu"}`} style={{ minHeight: "100vh", width: "100%" }}>
      {children}
    </div>
  );
}
