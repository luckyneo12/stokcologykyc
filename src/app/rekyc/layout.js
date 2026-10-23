import "./rekyc.css";
import RekycRoot from "@/components/rekyc/RekycRoot";

export const metadata = {
  title: "ReKYC — Stockology Securities",
  description: "Update your trading and demat account details.",
};

export default function RekycLayout({ children }) {
  return <RekycRoot>{children}</RekycRoot>;
}
