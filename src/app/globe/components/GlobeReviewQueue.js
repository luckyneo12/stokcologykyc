import { useState } from "react";

export default function GlobeReviewQueue({ applications, handleAction }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <h2 style={{ fontSize: "1.8rem", fontWeight: 900, letterSpacing: "-0.5px", margin: 0, color: "var(--text-primary)" }}>
            Review Queue
          </h2>
          <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontWeight: 600 }}>
            Manage and process pending KYC applications
          </p>
        </div>
      </div>

      <div style={{ background: "var(--bg-primary)", borderRadius: "24px", border: "1px solid var(--border-color)", overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,0.02)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--bg-secondary)", textAlign: "left" }}>
              <th style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>ID</th>
              <th style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>Date</th>
              <th style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>Globe Status</th>
              <th style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)", fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {applications.length > 0 ? applications.map((app) => (
              <tr key={app.id} style={{ borderBottom: "1px solid var(--border-color)", transition: "background 0.2s ease" }} onMouseOver={(e) => e.currentTarget.style.background = "var(--bg-secondary)"} onMouseOut={(e) => e.currentTarget.style.background = "transparent"}>
                <td style={{ padding: "20px 24px", fontWeight: 700, color: "var(--text-primary)" }}>{app.applicationId}</td>
                <td style={{ padding: "20px 24px", color: "var(--text-muted)", fontWeight: 600 }}>{new Date(app.createdAt).toLocaleDateString()}</td>
                <td style={{ padding: "20px 24px" }}>
                  <span style={{ 
                    padding: "6px 12px", borderRadius: "8px", fontSize: "0.75rem", fontWeight: 800, 
                    background: app.globeStatus === 'approved' ? '#10b98120' : app.globeStatus === 'rejected' ? '#ef444420' : '#f59e0b20', 
                    color: app.globeStatus === 'approved' ? '#10b981' : app.globeStatus === 'rejected' ? '#ef4444' : '#f59e0b', 
                    textTransform: 'uppercase' 
                  }}>
                    {app.globeStatus}
                  </span>
                </td>

                <td style={{ padding: "20px 24px", display: "flex", gap: "10px" }}>
                  <button onClick={() => window.location.href = `/globe/maker-checker/${app.id}`} style={{ padding: "8px 16px", background: "transparent", color: "var(--text-primary)", border: "1px solid var(--border-color)", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem", transition: "all 0.2s ease" }}>View</button>
                  {app.globeStatus === "pending" && (
                    <>
                      <button onClick={() => handleAction(app.id, 'approve')} style={{ padding: "8px 16px", background: "#10b981", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem", transition: "all 0.2s ease" }}>Approve</button>
                      <button onClick={() => handleAction(app.id, 'reject')} style={{ padding: "8px 16px", background: "#ef4444", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem", transition: "all 0.2s ease" }}>Reject</button>
                    </>
                  )}

                </td>
              </tr>
            )) : (
              <tr><td colSpan="5" style={{ padding: "60px", textAlign: "center", color: "var(--text-muted)", fontWeight: 600, fontSize: "1.1rem" }}>No applications available for review</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
