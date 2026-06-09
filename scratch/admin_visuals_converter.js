const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../src/app/admin/application/[id]/page.js');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Add helpers block before the return statement inside ApplicationDetail component
const helpersCode = `
  const getStepStatus = (stepName) => {
    let stepStatuses = {};
    try { stepStatuses = JSON.parse(app?.stepStatuses || "{}"); } catch(e) {}
    return stepStatuses[stepName];
  };

  const getSectionStyle = (stepName) => {
    const info = getStepStatus(stepName);
    if (info?.status === "approved") {
      return { border: "2px solid var(--wise-positive)", position: "relative", transition: "all 0.3s ease", boxShadow: "0 8px 30px rgba(34, 197, 94, 0.08)" };
    }
    if (info?.status === "rejected") {
      return { border: "2px solid var(--wise-danger)", position: "relative", transition: "all 0.3s ease", boxShadow: "0 8px 30px rgba(239, 68, 68, 0.08)" };
    }
    return { border: "1px solid var(--border-color)", position: "relative", transition: "all 0.3s ease" };
  };

  const renderSectionBadge = (stepName) => {
    const info = getStepStatus(stepName);
    if (info?.status === "approved") {
      return (
        <div style={{ position: "absolute", top: 16, right: 16, display: "flex", alignItems: "center", gap: 6, background: "rgba(34, 197, 94, 0.1)", color: "#22c55e", padding: "6px 14px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", zIndex: 10 }}>
          ✓ Verified
        </div>
      );
    }
    if (info?.status === "rejected") {
      return (
        <div style={{ position: "absolute", top: 16, right: 16, display: "flex", alignItems: "center", gap: 6, background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", padding: "6px 14px", borderRadius: 20, fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", zIndex: 10 }}>
          ⚠ Rejected
        </div>
      );
    }
    return null;
  };

  const getTrackedSteps = () => {
    const steps = ['personal', 'pricing', 'regulatory', 'address', 'bank'];
    
    // Nominees
    if (app?.nomineeDetails?.nominees?.length > 0) {
      app.nomineeDetails.nominees.forEach((_, idx) => {
        steps.push(\`nominee_\${idx}\`);
      });
    } else {
      steps.push('nominee');
    }
    
    // Documents / Biometrics
    steps.push('selfie');
    if (app?.panUpload?.filePreview) steps.push('pan_upload');
    if (app?.signature?.filePreview) steps.push('signature');
    if (app?.financialProof?.filePreview) steps.push('financial_proof');
    if (app?.personalDetails?.politicallyExposed === "Yes" && (app?.personalDetails?.pepProofPreview || app?.personalDetails?.pepProof)) {
      steps.push('pep_proof');
    }

    // Dynamic scan images
    const fetchedImages = [];
    const seenSrc = new Set();
    const scanForImages = (obj, path = "") => {
      if (!obj || typeof obj !== "object") return;
      if (obj.path && typeof obj.path === "string" && (obj.path.includes("/uploads/") || obj.path.includes("http"))) {
        const src = resolveAssetUrl(obj.path);
        if (!seenSrc.has(src)) {
          fetchedImages.push(src);
          seenSrc.add(src);
        }
      }
      const EXCLUDED_KEYS = ['proofPath', 'filePreview', 'preview', 'selfie', 'pepProofPreview', 'guardianProofPath'];
      Object.entries(obj).forEach(([key, value]) => {
        if (EXCLUDED_KEYS.includes(key)) return;
        if (typeof value === "string" && value.length > 500) {
          const cleanValue = value.replace(/^data:[a-z]+\\/[a-z]+;base64,/, "");
          const isBase64 = /^[A-Za-z0-9+/=]+$/.test(cleanValue.substring(0, 100));
          if (isBase64 || value.startsWith("data:") || value.startsWith("iVBORw") || value.startsWith("/9j/") || value.startsWith("JVBERi")) {
            let src = value;
            if (!value.startsWith("data:")) {
              if (value.startsWith("JVBERi")) {
                src = \`data:application/pdf;base64,\${value}\`;
              } else {
                src = \`data:image/jpeg;base64,\${value}\`;
              }
            }
            if (!seenSrc.has(src)) {
              fetchedImages.push(src);
              seenSrc.add(src);
            }
          }
        } else if (typeof value === "string" && value.includes("/uploads/") && !value.includes(" ")) {
          const src = resolveAssetUrl(value);
          if (!seenSrc.has(src)) {
            fetchedImages.push(src);
            seenSrc.add(src);
          }
        } else if (value && typeof value === "object" && key !== "reviewer") {
          scanForImages(value, key || path);
        }
      });
    };
    if (app) scanForImages(app);
    fetchedImages.forEach((_, idx) => {
      steps.push(\`fetched_image_\${idx}\`);
    });

    return steps;
  };

  const getApprovedStepsCount = () => {
    let stepStatuses = {};
    try { stepStatuses = JSON.parse(app?.stepStatuses || "{}"); } catch(e) {}
    let count = 0;
    const trackedSteps = getTrackedSteps();
    trackedSteps.forEach(s => {
      if (stepStatuses[s]?.status === 'approved') count++;
    });
    return count;
  };

  const getRejectedStepsCount = () => {
    let stepStatuses = {};
    try { stepStatuses = JSON.parse(app?.stepStatuses || "{}"); } catch(e) {}
    let count = 0;
    const trackedSteps = getTrackedSteps();
    trackedSteps.forEach(s => {
      if (stepStatuses[s]?.status === 'rejected') count++;
    });
    return count;
  };
  
  const trackedStepsList = app ? getTrackedSteps() : [];
  const approvedCount = app ? getApprovedStepsCount() : 0;
  const rejectedCount = app ? getRejectedStepsCount() : 0;
  const totalSteps = trackedStepsList.length;
`;

// Inject helpers just before return (
content = content.replace(/(return \(\s*<div style=\{\{\s*width: "100vw",)/, helpersCode + '\n  $1');

// 2. Rewrite Title Section inside the header to include progress bar
const originalHeader = `{/* Title Section */}
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 900, marginBottom: 0 }}>{app.personalDetails?.fullName || "Unnamed Applicant"}</h1>
          <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", margin: 0 }}>ID: <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{app.applicationId}</span></p>
        </div>`;

const newHeader = `{/* Title Section */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, gap: 32 }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 900, marginBottom: 4 }}>{app.personalDetails?.fullName || "Unnamed Applicant"}</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", margin: 0 }}>ID: <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{app.applicationId}</span></p>
          </div>
          {app && (
            <div style={{ minWidth: 320 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-secondary)" }}>Step Verification Status</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 900 }}>
                  <span style={{ color: "#22c55e" }}>{approvedCount} Approved</span>
                  <span style={{ color: "var(--text-muted)", margin: "0 6px" }}>|</span>
                  <span style={{ color: "#ef4444" }}>{rejectedCount} Rejected</span>
                </span>
              </div>
              <div style={{ display: "flex", gap: "4px", width: "100%" }}>
                {trackedStepsList.map((step, idx) => {
                  const status = getStepStatus(step)?.status;
                  let bg = "var(--border-color)";
                  if (status === "approved") bg = "#22c55e";
                  else if (status === "rejected") bg = "#ef4444";
                  return (
                    <div 
                      key={idx} 
                      title={\`\${step.toUpperCase()}: \${status || 'pending'}\`} 
                      style={{ flex: 1, height: 10, background: bg, borderRadius: 5, transition: "all 0.3s ease" }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>`;

content = content.replace(originalHeader, newHeader);

// 3. Section style visual marking replacements in Admin view
content = content.replace(/(<section className="card" style=\{\{ padding: 40 \}\}>)(\s*<h3[\s\S]*?Identity & Contact Details)/, '$1\n{renderSectionBadge("personal")}$2');
content = content.replace(/(<section className="card" style=\{\{ padding: 40 \}\}>)/, '<section className="card" style={{ padding: 40, ...getSectionStyle("personal") }}>');

content = content.replace(/(<section className="card" style=\{\{ padding: 40 \}\}>)(\s*<h3[\s\S]*?Segments & Pricing)/, '$1\n{renderSectionBadge("pricing")}$2');
content = content.replace(/(<section className="card" style=\{\{ padding: 40 \}\}>)/, '<section className="card" style={{ padding: 40, ...getSectionStyle("pricing") }}>');

content = content.replace(/(<section className="card" style=\{\{ padding: 16 \}\}>)(\s*<h3[\s\S]*?Regulatory Details)/, '$1\n{renderSectionBadge("regulatory")}$2');
content = content.replace(/(<section className="card" style=\{\{ padding: 16 \}\}>)/, '<section className="card" style={{ padding: 16, ...getSectionStyle("regulatory") }}>');

content = content.replace(/(<section className="card" style=\{\{ padding: 16 \}\}>)(\s*<h3[\s\S]*?Permanent Address)/, '$1\n{renderSectionBadge("address")}$2');
content = content.replace(/(<section className="card" style=\{\{ padding: 16 \}\}>)/, '<section className="card" style={{ padding: 16, ...getSectionStyle("address") }}>');

content = content.replace(/(<section className="card" style=\{\{ padding: 16 \}\}>)(\s*<h3[\s\S]*?Bank Details)/, '$1\n{renderSectionBadge("bank")}$2');
content = content.replace(/(<section className="card" style=\{\{ padding: 16 \}\}>)/, '<section className="card" style={{ padding: 16, ...getSectionStyle("bank") }}>');

// Nominee Details
content = content.replace(/(<section className="card" style=\{\{ padding: 16 \}\}>)(\s*<h3[\s\S]*?Nominee Details)/, '$1\n{renderSectionBadge("nominee")}$2');
content = content.replace(/(<section className="card" style=\{\{ padding: 16 \}\}>)/, '<section className="card" style={{ padding: 16, ...getSectionStyle("nominee") }}>');

// Nominee loop
content = content.replace(/(app.nomineeDetails.nominees.map\(\(nom, idx\) => \(\s*<div key=\{idx\} style=\{\{ padding: 32, background: "var\(--bg-secondary\)", borderRadius: 24, border: "1px solid var\(--border-color\)" \}\}>)/, '$1\n{renderSectionBadge("nominee_" + idx)}');
content = content.replace(/(style=\{\{ padding: 32, background: "var\(--bg-secondary\)", borderRadius: 24, border: "1px solid var\(--border-color\)" \}\})/, 'style={{ padding: 32, background: "var(--bg-secondary)", borderRadius: 24, ...getSectionStyle("nominee_" + idx) }}');

// Individual media cards inside Documents & Biometrics
content = content.replace(/(<div className="document-preview-card">)(\s*<div style=\{\{ display: "flex", justifyContent: "space-between", alignItems: "baseline" \}\}>\s*<span className="inspection-label">Selfie Capture)/, '$1\n{renderSectionBadge("selfie")}$2');
content = content.replace(/(<div className="document-preview-card">)/, '<div className="document-preview-card" style={getSectionStyle("selfie")}>');

content = content.replace(/(<div className="document-preview-card">)(\s*<span className="inspection-label">PAN Card Upload)/, '$1\n{renderSectionBadge("pan_upload")}$2');
content = content.replace(/(<div className="document-preview-card">)/, '<div className="document-preview-card" style={getSectionStyle("pan_upload")}>');

content = content.replace(/(<div className="document-preview-card">)(\s*<span className="inspection-label">Wet Signature)/, '$1\n{renderSectionBadge("signature")}$2');
content = content.replace(/(<div className="document-preview-card">)/, '<div className="document-preview-card" style={getSectionStyle("signature")}>');

content = content.replace(/(<div className="document-preview-card" onClick=\{\(\) => app.financialProof\?\.filePreview && openInNewTab\(app.financialProof.filePreview\)\} style=\{\{ cursor: "pointer" \}\}>)(\s*<span className="inspection-label">Financial Proof)/, '$1\n{renderSectionBadge("financial_proof")}$2');
content = content.replace(/(<div className="document-preview-card" onClick=\{\(\) => app.financialProof\?\.filePreview && openInNewTab\(app.financialProof.filePreview\)\} style=\{\{ cursor: "pointer" \}\}>)/, '<div className="document-preview-card" onClick={() => app.financialProof?.filePreview && openInNewTab(app.financialProof.filePreview)} style={{ cursor: "pointer", ...getSectionStyle("financial_proof") }}>');

content = content.replace(/(<div className="document-preview-card" onClick=\{\(\) => \(app.personalDetails\?\.pepProofPreview \|\| app.personalDetails\?\.pepProof\) && openInNewTab\(resolveAssetUrl\(app.personalDetails.pepProofPreview \|\| app.personalDetails.pepProof\)\)\} style=\{\{ cursor: "pointer" \}\}>)(\s*<span className="inspection-label" style=\{\{ color: "var\(--wise-green\)" \}\}>PEP Proof Preview)/, '$1\n{renderSectionBadge("pep_proof")}$2');
content = content.replace(/(<div className="document-preview-card" onClick=\{\(\) => \(app.personalDetails\?\.pepProofPreview \|\| app.personalDetails\?\.pepProof\) && openInNewTab\(resolveAssetUrl\(app.personalDetails.pepProofPreview \|\| app.personalDetails.pepProof\)\)\} style=\{\{ cursor: "pointer" \}\}>)/, '<div className="document-preview-card" onClick={() => (app.personalDetails?.pepProofPreview || app.personalDetails?.pepProof) && openInNewTab(resolveAssetUrl(app.personalDetails.pepProofPreview || app.personalDetails.pepProof))} style={{ cursor: "pointer", ...getSectionStyle("pep_proof") }}>');

// Scanned loop
content = content.replace(/(fetchedImages.map\(\(img, idx\) => \(\s*<div key=\{idx\} className="document-preview-card" style=\{\{ background: "white", padding: 16, borderRadius: 20, boxShadow: "0 4px 20px rgba\(0,0,0,0.05\)" \}\}>)/, '$1\n{renderSectionBadge("fetched_image_" + idx)}');
content = content.replace(/(style=\{\{ background: "white", padding: 16, borderRadius: 20, boxShadow: "0 4px 20px rgba\(0,0,0,0.05\)" \}\})/, 'style={{ background: "white", padding: 16, borderRadius: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.05)", ...getSectionStyle("fetched_image_" + idx) }}');

fs.writeFileSync(targetFile, content);
console.log('done');
