const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../src/app/agent/submissions/[id]/page.js');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Add getStepStatus, getSectionStyle, renderSectionBadge right below getTrackedSteps block
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
`;

// Insert the helpers code right under: const progressPercent = totalSteps > 0 ? Math.round((approvedCount / totalSteps) * 100) : 0;
content = content.replace(/(const progressPercent = totalSteps > 0 \? Math\.round\(\(approvedCount \/ totalSteps\) \* 100\) : 0;)/, '$1\n' + helpersCode + '\n  const rejectedCount = app ? getRejectedStepsCount() : 0;\n');

// Also need to define getRejectedStepsCount inside progress bar calculations
const getRejectedStepsCountLogic = `
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
`;
content = content.replace(/(const getApprovedStepsCount = \(\) => \{[\s\S]*?\}\s*;\s*\}\s*;\s*const approvedCount)/, getRejectedStepsCountLogic + '\n$1');

// 2. Rewrite progress bar layout inside the header
const originalHeaderCode = `<div style={{ marginLeft: "auto", minWidth: 300 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-secondary)" }}>Review Progress</span>
            <span style={{ fontSize: "0.85rem", fontWeight: 900, color: "var(--wise-dark-green)" }}>{approvedCount} / {totalSteps} Steps Approved</span>
          </div>
          <div style={{ width: "100%", height: 10, background: "var(--bg-secondary)", borderRadius: 5, overflow: "hidden", border: "1px solid var(--border-color)" }}>
            <div style={{ width: \`\${progressPercent}%\`, height: "100%", background: "var(--wise-positive)", transition: "width 0.3s ease" }}></div>
          </div>
        </div>`;

const newHeaderCode = `{app && (
        <div style={{ marginLeft: "auto", minWidth: 320 }}>
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
      )}`;

content = content.replace(originalHeaderCode, newHeaderCode);

// 3. Section style visual marking replacements
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
