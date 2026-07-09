export function extractCertificateNumbers(text) {
  const results = new Set();
  
  // Normalize common OCR noise
  const cleaned = text
    .replace(/[''`]/g, '')  // remove stray quotes
    .replace(/\r\n/g, '\n');

  // Pattern 1: Standard IN-XX followed by digits (most common)
  const p1 = cleaned.match(/IN[-–—.\s]?[A-Z]{2}[-–—.\s]?\d[\d\s]{6,20}/gi) || [];
  for (const m of p1) {
    const normalized = m.replace(/[\s–—.]/g, '').replace(/^IN/i, 'IN-').replace(/^IN--/, 'IN-').toUpperCase();
    if (/^IN-[A-Z]{2}\d{7,}$/.test(normalized)) {
      results.add(normalized);
    }
  }

  // Pattern 2: OCR misreads I as 1 or l, N as |\[
  const p2 = cleaned.match(/[I1l][N|\\\[\]][-–—.\s]?[A-Z]{2}[-–—.\s]?\d[\d\s]{6,20}/gi) || [];
  for (const m of p2) {
    let normalized = m.replace(/[\s–—.]/g, '').toUpperCase();
    normalized = normalized.replace(/^[I1L][N|\\\[\]]/i, 'IN-');
    normalized = normalized.replace(/^IN--/, 'IN-');
    if (/^IN-[A-Z]{2}\d{7,}$/.test(normalized)) {
      results.add(normalized);
    }
  }

  // Pattern 3: Look for "Certificate No" label followed by value
  const certLabelPattern = /(?:certificate\s*(?:no\.?|number)\s*:?\s*)([A-Z0-9][-A-Z0-9\s]{8,30})/gi;
  let match;
  while ((match = certLabelPattern.exec(cleaned)) !== null) {
    const val = match[1].replace(/\s+/g, '').toUpperCase();
    if (/^IN-?[A-Z]{2}\d{7,}$/.test(val)) {
      const normalized = val.replace(/^IN([A-Z])/, 'IN-$1');
      results.add(normalized);
    }
  }

  return [...results];
}

export function extractSerialNumbers(text, certificateNumbers = []) {
  const results = new Set();

  const cleaned = text
    .replace(/[''`]/g, '')
    .replace(/\r\n/g, '\n');

  // Pattern 1: Labeled serial numbers
  const labeledPatterns = [
    /(?:serial\s*(?:no\.?|number)\s*:?\s*)(\d[\d\s]{4,14})/gi,
    /(?:sr\.?\s*(?:no\.?)?\s*:?\s*)(\d[\d\s]{4,14})/gi,
    /(?:s\.?\s*no\.?\s*:?\s*)(\d[\d\s]{4,14})/gi,
  ];

  for (const pattern of labeledPatterns) {
    let match;
    while ((match = pattern.exec(cleaned)) !== null) {
      const num = match[1].replace(/\s+/g, '');
      if (num.length >= 6 && num.length <= 14) {
        results.add(num);
      }
    }
  }

  // Pattern 2: Standalone digit sequences (6-14 digits)
  const standalonePattern = /\b(\d{6,14})\b/g;
  let match;
  while ((match = standalonePattern.exec(cleaned)) !== null) {
    const num = match[1];
    const isPartOfCert = certificateNumbers.some(cert => cert.includes(num));
    if (!isPartOfCert) {
      results.add(num);
    }
  }

  return [...results];
}

export function extractEStampEntries(text) {
  const certNumbers = extractCertificateNumbers(text);
  const serialNumbers = extractSerialNumbers(text, certNumbers);

  const entries = [];

  if (certNumbers.length === 0 && serialNumbers.length === 0) {
    entries.push({ certificateNo: "", serialNo: "" });
    return entries;
  }

  const maxCount = Math.max(certNumbers.length, serialNumbers.length);

  for (let i = 0; i < maxCount; i++) {
    entries.push({
      certificateNo: certNumbers[i] || "",
      serialNo: serialNumbers[i] || "",
    });
  }

  return entries;
}
