import "./rekyc-admin.css";

export const metadata = {
  title: "ReKYC Admin — Stockology",
  description: "Review and approve client modification (ReKYC) requests.",
};

export default function RekycAdminLayout({ children }) {
  return <div className="ra-root">{children}</div>;
}
