const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../src/app/agent/submissions/[id]/page.js');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Progress Bar Logic
// I need to add logic to calculate approved steps.
// The steps we track are: 'personal', 'pricing', 'regulatory', 'address', 'bank', 'nominee', 'selfie'. (Total 7)
const progressBarLogic = `
  const getApprovedStepsCount = () => {
    let stepStatuses = {};
    try { stepStatuses = JSON.parse(app?.stepStatuses || "{}"); } catch(e) {}
    let count = 0;
    const trackedSteps = ['personal', 'pricing', 'regulatory', 'address', 'bank', 'nominee', 'selfie'];
    trackedSteps.forEach(s => {
      if (stepStatuses[s]?.status === 'approved') count++;
    });
    return count;
  };
  const approvedCount = app ? getApprovedStepsCount() : 0;
  const totalSteps = 7;
  const progressPercent = Math.round((approvedCount / totalSteps) * 100);
`;

// Insert the logic just before return
content = content.replace(/(return \(\s*<div)/, progressBarLogic + '\n  $1');

// 2. Add Progress Bar UI
const progressBarUI = `
        <div style={{ marginLeft: "auto", minWidth: 300 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "var(--text-secondary)" }}>Review Progress</span>
            <span style={{ fontSize: "0.85rem", fontWeight: 900, color: "var(--wise-dark-green)" }}>{approvedCount} / {totalSteps} Steps Approved</span>
          </div>
          <div style={{ width: "100%", height: 10, background: "var(--bg-secondary)", borderRadius: 5, overflow: "hidden", border: "1px solid var(--border-color)" }}>
            <div style={{ width: \`\${progressPercent}%\`, height: "100%", background: "var(--wise-positive)", transition: "width 0.3s ease" }}></div>
          </div>
        </div>
`;
content = content.replace(/(<h1.*?\{app\.personalDetails\?\.fullName[\s\S]*?<\/div>)/, '$1\n' + progressBarUI);

// 3. Inject renderStepReview into sections
// Since replacing with regex can be tricky due to dynamic layout, I will target the exact ending of the sections using `</section>` preceded by specific elements.

function insertBeforeSectionEnd(content, keyword, injection) {
  // Find the index of the keyword
  const keywordIndex = content.indexOf(keyword);
  if (keywordIndex === -1) return content;
  
  // Find the next `</section>` after the keyword
  const endSectionIndex = content.indexOf('</section>', keywordIndex);
  if (endSectionIndex === -1) return content;

  return content.slice(0, endSectionIndex) + injection + '\\n' + content.slice(endSectionIndex);
}

// Identity & Contact Details (Keyword: "Father's Name")
content = insertBeforeSectionEnd(content, "Father's Name", '\\n{renderStepReview("personal")}');

// Segments & Pricing (Keyword: "Trading Segments")
content = insertBeforeSectionEnd(content, "Trading Segments", '\\n{renderStepReview("pricing")}');

// Regulatory Details (Keyword: "Delivery Instruction Slip (DIS)")
content = insertBeforeSectionEnd(content, "Delivery Instruction Slip (DIS)", '\\n{renderStepReview("regulatory")}');

// Permanent Address (Keyword: "Address Data (Aadhaar)")
content = insertBeforeSectionEnd(content, "Address Data (Aadhaar)", '\\n{renderStepReview("address")}');

// Bank Information (Keyword: "MICR Code")
content = insertBeforeSectionEnd(content, "MICR Code", '\\n{renderStepReview("bank")}');

// Nominee Details (Keyword: "Nominee 1")
content = insertBeforeSectionEnd(content, "Nominee 1", '\\n{renderStepReview("nominee")}');
// Also if no nominee:
content = content.replace(/(No Nominees Added<\/div>[\s\S]*?)(<\/section>)/, '$1{renderStepReview("nominee")}\n$2');

// Biometrics & Liveness (Keyword: "Biometrics & Liveness")
content = insertBeforeSectionEnd(content, "Biometrics & Liveness", '\\n{renderStepReview("selfie")}');

fs.writeFileSync(targetFile, content);
console.log('done');
