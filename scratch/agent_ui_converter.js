const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../src/app/agent/submissions/[id]/page.js');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Rename ApplicationDetail to AgentReview
content = content.replace(/export default function ApplicationDetail\(\) \{/g, 'export default function AgentReview() {');

// 2. Change adminToken to agent_token
content = content.replace(/localStorage\.getItem\("adminToken"\)/g, 'localStorage.getItem("agent_token")');
content = content.replace(/router\.push\("\/admin\/login"\)/g, 'router.push("/agent/login")');

// 3. Remove AdminSidebar
content = content.replace(/import AdminSidebar from "\.\.\/\.\.\/components\/AdminSidebar";\n/, '');
content = content.replace(/const \[collapsedSidebar, setCollapsedSidebar\] = useState\(false\);\n/, '');
content = content.replace(/<AdminSidebar collapsed=\{collapsedSidebar\} onToggle=\{.*?\} \/>/g, '');

// 4. Remove Assign to Agent block
content = content.replace(/\{\/\* Assign to Agent \*\/\}.*?\{\/\* Progress Tracking \*\/\}/s, '{/* Progress Tracking */}');

// 5. Remove Approve/Reject/Delete overarching buttons
content = content.replace(/<button onClick=\{.*\} className="admin-btn admin-btn-primary" style=\{\{ width: "100%", background: "#10b981", color: "white" \}\}>[\s\S]*?Reject Application[\s\S]*?<\/button>[\s\S]*?<\/div>[\s\S]*?<\/div>/, '</div></div>');
content = content.replace(/\{\/\* Danger Zone \*\/\}.*?<\/div>.*?(<\/div>\s*<\/div>\s*<\/div>)$/s, '$1');

// 6. Inject handleReviewStep logic
const reviewLogic = `
  const [rejectingStep, setRejectingStep] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReviewStep = async (stepName, status) => {
    if (status === "rejected" && !rejectReason) {
      showToast("Please provide a rejection reason", "error");
      return;
    }
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem("agent_token");
      const res = await fetchWithFallback(\`/api/agent/kyc/\${app.applicationId}/step/\${stepName}/review\`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: \`Bearer \${token}\` 
        },
        body: JSON.stringify({ status, reason: status === "rejected" ? rejectReason : undefined })
      });
      const data = await res.json();
      if (data.success) {
        showToast(\`Step \${stepName} marked as \${status}\`);
        setRejectingStep(null);
        setRejectReason("");
        fetchDetail();
      } else {
        showToast(data.error || "Failed to update step", "error");
      }
    } catch (error) {
      showToast("Network error during step review", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepReview = (stepName) => {
    let stepStatuses = {};
    try { stepStatuses = JSON.parse(app.stepStatuses || "{}"); } catch(e) {}
    const status = stepStatuses[stepName]?.status;

    if (status === "approved") {
      return (
        <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(34, 197, 94, 0.1)", borderRadius: 8, color: "#22c55e", fontWeight: 700, fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: 6 }}>
          ✓ Step Approved
        </div>
      );
    }
    
    if (rejectingStep === stepName) {
      return (
        <div style={{ marginTop: 16, background: "var(--bg-primary)", padding: 16, borderRadius: 12, border: "1px solid var(--border-color)" }}>
          <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, marginBottom: 8 }}>Rejection Reason:</label>
          <input type="text" className="admin-input" style={{ width: "100%", marginBottom: 12 }} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Type reason here..." />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setRejectingStep(null)} className="admin-btn admin-btn-secondary" style={{ padding: "6px 12px", fontSize: "0.8rem" }}>Cancel</button>
            <button onClick={() => handleReviewStep(stepName, "rejected")} disabled={isSubmitting} className="admin-btn" style={{ padding: "6px 12px", fontSize: "0.8rem", background: "#ef4444", color: "white" }}>{isSubmitting ? "..." : "Confirm Reject"}</button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
        <button onClick={() => handleReviewStep(stepName, "approved")} disabled={isSubmitting} className="admin-btn admin-btn-primary" style={{ padding: "6px 16px", fontSize: "0.8rem", background: "rgba(34, 197, 94, 0.1)", color: "#22c55e", border: "1px solid rgba(34, 197, 94, 0.3)" }}>
          Approve Step
        </button>
        <button onClick={() => { setRejectingStep(stepName); setRejectReason(stepStatuses[stepName]?.reason || ""); }} disabled={isSubmitting} className="admin-btn admin-btn-secondary" style={{ padding: "6px 16px", fontSize: "0.8rem", color: "#ef4444", border: "1px solid rgba(239, 68, 68, 0.3)" }}>
          Reject Step
        </button>
        {status === "rejected" && <span style={{ color: "#ef4444", fontSize: "0.8rem", display: "flex", alignItems: "center", marginLeft: 8 }}>Previously Rejected: {stepStatuses[stepName]?.reason}</span>}
      </div>
    );
  };
`;

content = content.replace(/const \[toast, setToast\] = useState\(null\);/, 'const [toast, setToast] = useState(null);\n' + reviewLogic);

// 7. Inject renderStepReview into sections
// We need to inject {renderStepReview("personal")} at the end of Personal Details section etc.
// The sections end with `</section>`. Let's do replacements.

// Identity & Contact Details
content = content.replace(/(<h2 style=\{\{.*?\}\}>Identity & Contact Details<\/h2>[\s\S]*?)(<\/section>)/, '$1{renderStepReview("personal")}\n$2');

// Segments & Pricing
content = content.replace(/(<h2 style=\{\{.*?\}\}>Segments & Pricing<\/h2>[\s\S]*?)(<\/section>)/, '$1{renderStepReview("pricing")}\n$2');

// Regulatory Details
content = content.replace(/(<h2 style=\{\{.*?\}\}>Regulatory Details<\/h2>[\s\S]*?)(<\/section>)/, '$1{renderStepReview("regulatory")}\n$2');

// Permanent Address
content = content.replace(/(<h2 style=\{\{.*?\}\}>Permanent Address<\/h2>[\s\S]*?)(<\/section>)/, '$1{renderStepReview("address")}\n$2');

// Bank Information
content = content.replace(/(<h2 style=\{\{.*?\}\}>Bank Information<\/h2>[\s\S]*?)(<\/section>)/, '$1{renderStepReview("bank")}\n$2');

// Nominee Details
content = content.replace(/(<h2 style=\{\{.*?\}\}>Nominee Details<\/h2>[\s\S]*?)(<\/section>)/, '$1{renderStepReview("nominee")}\n$2');

// Biometrics & Liveness
content = content.replace(/(<h2 style=\{\{.*?\}\}>Biometrics & Liveness<\/h2>[\s\S]*?)(<\/section>)/, '$1{renderStepReview("selfie")}\n$2');

fs.writeFileSync(targetFile, content);
console.log('done');
