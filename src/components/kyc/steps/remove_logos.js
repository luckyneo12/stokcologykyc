const fs = require('fs');
const path = require('path');

const stepsDir = 'd:/KYC Journey 2/kyc-app/src/components/kyc/steps';
const files = fs.readdirSync(stepsDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const filePath = path.join(stepsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Pattern 1: Logo inside a div with margin
  const pattern1 = /<div style={{[^}]*margin:[^}]*}}>\s*<Logo[^>]*\/>\s*<\/div>/g;
  
  // Pattern 2: Logo alone
  const pattern2 = /<Logo[^>]*\/>/g;
  
  // Pattern 3: Logo inside a div with display flex
  const pattern3 = /<div style={{[^}]*display:\s*"flex"[^}]*justifyContent:\s*"center"[^}]*}}>\s*<Logo[^>]*\/>\s*<\/div>/g;

  let newContent = content.replace(pattern3, '').replace(pattern1, '').replace(pattern2, '');
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent);
    console.log(`Updated ${file}`);
  }
});
