const fs = require('fs');
const file = 'c:/Users/vampi/OneDrive/Desktop/Kyc-Portal-New-main/src/components/kyc/steps/NomineeStep.js';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/ \*(?=<\/label>)/g, ' <span style={{ color: "var(--wise-danger)" }}>*</span>');
content = content.replace(/<span>\*<\/span>/g, '<span style={{ color: "var(--wise-danger)" }}>*</span>');
content = content.replace(/\{!nom.relation \? "\*" : ""\}/g, '{!nom.relation ? <span style={{ color: "var(--wise-danger)" }}>*</span> : ""}');
fs.writeFileSync(file, content);
console.log("Replaced successfully in NomineeStep.");
