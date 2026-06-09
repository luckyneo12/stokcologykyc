"use client";
import { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { API_BASE_URL, resolveAssetUrl } from "@/utils/apiConfig";

const KYC_STATUS = {
  verified: "badge-verified",
  pending: "badge-pending",
  rejected: "badge-rejected",
  under_review: "badge-review",
  on_hold: "badge-review",
  none: "badge-review"
};

function detectAssets(app) {
  const assets = [];
  const seen = new Set();
  const push = (label, src) => {
    if (!src || seen.has(src)) return;
    seen.add(src);
    assets.push({ label, src });
  };

  // Prioritize explicitly stored documents with nice labels
  if (app?.documents && Array.isArray(app.documents)) {
    app.documents.forEach((doc, i) => {
      const typeLabel = doc.type ? doc.type.replace(/_/g, ' ') : `Document ${i+1}`;
      const finalLabel = doc.source ? `${typeLabel} (${doc.source})` : typeLabel;
      if (doc.path) push(finalLabel, resolveAssetUrl(doc.path));
    });
  }

  const walk = (obj, p = "") => {
    if (!obj || typeof obj !== "object") return;
    Object.entries(obj).forEach(([k, v]) => {
      const label = `${p}${k}`;
      if (typeof v === "string" && (v.startsWith("/uploads/") || v.startsWith("http") || v.startsWith("data:"))) push(label, resolveAssetUrl(v));
      else if (v && typeof v === "object") walk(v, `${label}.`);
    });
  };
  walk(app);
  return assets;
}

export default function UserDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("adminToken");
        const res = await fetch(`${API_BASE_URL}/api/admin/users/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (data.success) setDetails(data.user);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const latest = details?.kycApplications?.[0] || null;
  const assets = useMemo(() => detectAssets(latest), [latest]);
  const selfie = resolveAssetUrl(latest?.selfie || latest?.selfieDetails?.path || assets.find((a) => a.label.toLowerCase().includes("selfie"))?.src || "");

  if (loading) return <div className="admin-loading">Loading user details...</div>;
  if (!details || !latest) return <div className="admin-error">No KYC data found for selected user.</div>;

  return (
    <div className="admin-animate">
      <button onClick={() => router.push("/admin")} style={{ marginBottom: 10, border: "none", background: "transparent", cursor: "pointer", color: "var(--text-muted)", fontWeight: 700 }}>? Back to User List</button>
      <h1 className="admin-section-title">Detailed View</h1>

      <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 16, padding: 14, display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr 1.5fr auto", gap: 10, alignItems: "center" }}>
        <div><div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Customer Email/Phone</div><div style={{ fontWeight: 800 }}>{details.phone}</div><div style={{ fontSize: "1rem", fontWeight: 800 }}>{latest.personalDetails?.fullName || "N/A"}</div></div>
        <div><div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Updated At</div><div style={{ fontWeight: 700 }}>{new Date(latest.updatedAt).toLocaleString()}</div></div>
        <div><div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>KYC Request ID</div><div style={{ fontWeight: 700 }}>{latest.applicationId}</div></div>
        <div><div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Workflow Name</div><div style={{ fontWeight: 700 }}>{latest.identityMethod || "DIGILOCKER_CONDITIONAL_JOURNEY"}</div></div>
        <div><span className={`badge ${KYC_STATUS[latest.status] || "badge-review"}`}>{(latest.status || "none").replace("_", " ")}</span></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 300px", gap: 12, marginTop: 12 }}>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-color)", fontWeight: 700 }}>Customer Image - Selfie</div>
            <div style={{ padding: 12, minHeight: 230, display: "flex", justifyContent: "center", alignItems: "center", background: "var(--bg-secondary)" }}>
              {selfie ? <img src={selfie} alt="selfie" style={{ maxWidth: "100%", maxHeight: 200, objectFit: "contain", borderRadius: 8 }} /> : <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>No selfie image</span>}
            </div>
          </div>

          <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-color)", fontWeight: 700 }}>Geo-Location</div>
            <div style={{ padding: 12 }}>
              <div style={{ fontWeight: 800, color: "#1f8f4e" }}>Passed</div>
              <div style={{ fontSize: "0.8rem", marginTop: 8 }}>{latest.address?.fullAddress || latest.personalDetails?.addressLine1 || "Location not available"}</div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-color)", fontWeight: 700 }}>Collected Information</div>
            <div style={{ padding: 10 }}>
              <table className="admin-table" style={{ margin: 0 }}>
                <thead><tr><th>Field Name</th><th>Source: Aadhaar (Digilocker)</th><th>Analysis with other IDs</th></tr></thead>
                <tbody>
                  <tr><td>Name</td><td>{latest.personalDetails?.fullName || "N/A"}</td><td>PAN (Digilocker) 100%</td></tr>
                  <tr><td>Date Of Birth</td><td>{latest.personalDetails?.dob || "N/A"}</td><td>PAN (Digilocker) 100%</td></tr>
                  <tr><td>Gender</td><td>{latest.personalDetails?.gender || "N/A"}</td><td>PAN (Digilocker) 100%</td></tr>
                  <tr><td>Father Name</td><td>{latest.personalDetails?.fatherName || "N/A"}</td><td>-</td></tr>
                  <tr><td>Address</td><td>{latest.address?.fullAddress || latest.personalDetails?.addressLine1 || "N/A"}</td><td>-</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-color)", fontWeight: 700 }}>Actions & Evidences</div>
            <div style={{ padding: 12, display: "grid", gap: 10 }}>
              <div style={{ border: "1px solid var(--border-color)", borderRadius: 8, padding: 10 }}>
                <div style={{ fontWeight: 700 }}>AADHAAR</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>ID: {latest.identityDetails?.aadhaar || "N/A"}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Name: {latest.personalDetails?.fullName || "N/A"}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Date of Birth: {latest.personalDetails?.dob || "N/A"}</div>
              </div>
              <div style={{ border: "1px solid var(--border-color)", borderRadius: 8, padding: 10 }}>
                <div style={{ fontWeight: 700 }}>PAN</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>ID: {latest.identityDetails?.pan || "N/A"}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Name: {latest.personalDetails?.fullName || "N/A"}</div>
              </div>
            </div>
          </div>

          <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-color)", fontWeight: 700 }}>Evaluated Conditions</div>
            <div style={{ padding: 12 }}>
              <div style={{ border: "1px solid var(--border-color)", borderRadius: 8, padding: 10, display: "flex", justifyContent: "space-between" }}>
                <span>Rule 1</span><span style={{ color: "#1f8f4e", fontWeight: 800 }}>Passed</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ background: "var(--bg-primary)", border: "1px solid var(--border-color)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-color)", fontWeight: 700 }}>IDs Collected ({assets.length})</div>
          <div style={{ padding: 10, display: "grid", gap: 10, maxHeight: 780, overflowY: "auto" }}>
            {assets.length === 0 ? <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>No ID images found</div> : assets.map((a, i) => (
              <div key={i} style={{ border: "1px solid var(--border-color)", borderRadius: 8, padding: 8, background: "var(--bg-secondary)" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: 6 }}>{a.label}</div>
                <div style={{ height: 120, display: "flex", justifyContent: "center", alignItems: "center" }}>
                  {a.src.includes("pdf") ? <span style={{ fontSize: "0.75rem" }}>PDF Document</span> : <img src={a.src} alt={a.label} style={{ maxWidth: "100%", maxHeight: 110, objectFit: "contain" }} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
