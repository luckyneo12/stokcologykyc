const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../src/app/agent/submissions/[id]/page.js');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Rewrite getTrackedSteps and getApprovedStepsCount
const newProgressLogic = `
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
          const cleanValue = value.replace(/^data:[a-z]+\/[a-z]+;base64,/, "");
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
  
  const trackedStepsList = app ? getTrackedSteps() : [];
  const approvedCount = app ? getApprovedStepsCount() : 0;
  const totalSteps = trackedStepsList.length;
  const progressPercent = totalSteps > 0 ? Math.round((approvedCount / totalSteps) * 100) : 0;
`;

// Replace old progress bar logic
content = content.replace(/const getApprovedStepsCount = \(\) => \{[\s\S]*?const progressPercent = Math\.round\(\(approvedCount \/ totalSteps\) \* 100\);/, newProgressLogic);

// 2. Inject step review under Permanent Address
content = content.replace(/(Permanent Address[\s\S]*?pincode\s*<\/div>)([\s\S]*?<\/section>)/, '$1\n{renderStepReview("address")}$2');

// 3. Inject step review under Nominees
content = content.replace(/(guardianProofPath'\];[\s\S]*?)(nom.guardianName[\s\S]*? guardian proof image uploaded[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>\s*\}\s*<\/div>)([\s\S]*?<\/div>\s*\}\)\s*<\/div>)/, '$1$2\n{renderStepReview("nominee_" + idx)}$3');

// 4. Inject step review under Selfie Capture
content = content.replace(/(Selfie Capture[\s\S]*?No selfie captured<\/div>\s*\}\s*<\/div>)([\s\S]*?<\/div>)/, '$1\n{renderStepReview("selfie")}$2');

// 5. Inject step review under PAN Card Upload
content = content.replace(/(PAN Card Upload[\s\S]*?No PAN uploaded<\/div>\s*\}\s*<\/div>)([\s\S]*?<\/div>)/, '$1\n{renderStepReview("pan_upload")}$2');

// 6. Inject step review under Wet Signature
content = content.replace(/(Wet Signature[\s\S]*?No signature uploaded<\/div>\s*\}\s*<\/div>)([\s\S]*?<\/div>)/, '$1\n{renderStepReview("signature")}$2');

// 7. Inject step review under Financial Proof
content = content.replace(/(Financial Proof[\s\S]*?OPEN IN NEW TAB ↗<\/div>\s*\}\s*<\/div>)([\s\S]*?<\/div>)/, '$1\n{renderStepReview("financial_proof")}$2');

// 8. Inject step review under PEP Proof Preview
content = content.replace(/(PEP Proof Preview[\s\S]*?VIEW FULL PROOF ↗<\/div>\s*\}\s*<\/div>)([\s\S]*?<\/div>\s*\}\))/, '$1\n{renderStepReview("pep_proof")}$2');

// 9. Inject step review under All System Documents & Images (fetchedImages loop)
content = content.replace(/(View Full \{img\.src\.toLowerCase\(\)\.endsWith\('.pdf'\) \? 'PDF' : 'Image'\} ↗[\s\S]*?<\/button>\s*<\/div>)([\s\S]*?<\/div>)/, '$1\n{renderStepReview("fetched_image_" + idx)}$2');

// 10. Strip Assign to Agent sidebar card (between the sticky container and Progress card)
content = content.replace(/<div className="card" style=\{\{ padding: 20 \}\}>\s*<span className="inspection-label" style=\{\{ display: "block", marginBottom: 12 \}\}>Assign to Agent<\/span>[\s\S]*?<\/button>\s*<\/div>/, '');

// 11. Strip overarching Approve / Reject buttons
content = content.replace(/<div style=\{\{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20 \}\}>[\s\S]*?Confirm Rejection[\s\S]*?<\/button>\s*<\/div>\s*\}\)/, '');

// 12. Strip Delete KYC Request card
content = content.replace(/<div style=\{\{ marginTop: 24, padding: 24, border: "1px dashed var\(--border-color\)", borderRadius: 16 \}\}>[\s\S]*?<\/div>\s*<\/div>/, '</div>');

fs.writeFileSync(targetFile, content);
console.log('done');
