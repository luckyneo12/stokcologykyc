const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const { listChanges } = require("./changes");
const { fetchBuffer } = require("./storage");

// Modification request form: the client's ReKYC e-stamp first, then the old → new table and declarations.

const A4 = [595.28, 841.89];
const MARGIN = 40;
const DARK = rgb(0.1, 0.12, 0.2);
const MUTED = rgb(0.4, 0.43, 0.5);
const LINE = rgb(0.8, 0.82, 0.87);
const BRAND = rgb(0.12, 0.23, 0.54);

// Standard PDF fonts only cover basic Latin characters
function clean(value) {
  return String(value ?? "-").replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim() || "-";
}

function wrap(text, font, size, width) {
  const words = clean(text).split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    let piece = word;
    while (font.widthOfTextAtSize(piece, size) > width) {
      let cut = piece.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(piece.slice(0, cut), size) > width) cut--;
      if (current) { lines.push(current); current = ""; }
      lines.push(piece.slice(0, cut));
      piece = piece.slice(cut);
    }
    const next = current ? `${current} ${piece}` : piece;
    if (font.widthOfTextAtSize(next, size) > width && current) {
      lines.push(current);
      current = piece;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ["-"];
}

async function appendEStamp(pdf, estamp) {
  if (!estamp?.file_url) return;
  const { buffer, contentType } = await fetchBuffer(estamp.file_url);
  const isPdf = String(contentType || "").includes("pdf") || buffer.slice(0, 4).toString() === "%PDF";
  if (isPdf) {
    const stampPdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const pages = await pdf.copyPages(stampPdf, stampPdf.getPageIndices());
    pages.forEach((p) => pdf.addPage(p));
    return;
  }
  const isPng = buffer.slice(1, 4).toString() === "PNG";
  const image = isPng ? await pdf.embedPng(buffer) : await pdf.embedJpg(buffer);
  const page = pdf.addPage(A4);
  const scale = Math.min((A4[0] - 2 * MARGIN) / image.width, (A4[1] - 2 * MARGIN) / image.height);
  page.drawImage(image, {
    x: (A4[0] - image.width * scale) / 2,
    y: A4[1] - MARGIN - image.height * scale,
    width: image.width * scale,
    height: image.height * scale,
  });
}

async function buildModificationPdf({ request, estamp }) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Modification Request ${request.id}`);
  pdf.setProducer("Stockology ReKYC");
  await appendEStamp(pdf, estamp);

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage(A4);
  let y = A4[1] - MARGIN;

  const newPage = () => {
    page = pdf.addPage(A4);
    y = A4[1] - MARGIN;
  };
  const ensure = (height) => {
    if (y - height < MARGIN + 60) newPage();
  };
  const text = (value, { x = MARGIN, size = 10, f = font, color = DARK } = {}) => {
    page.drawText(clean(value), { x, y, size, font: f, color });
  };

  text("STOCKOLOGY SECURITIES PVT. LTD.", { size: 15, f: bold, color: BRAND });
  y -= 20;
  text("Client Modification Request Form (ReKYC)", { size: 12, f: bold });
  y -= 24;

  const original = request.original_profile || {};
  const meta = [
    ["Request ID", request.id],
    ["Client Code", request.client_code],
    ["Client Name", original.name || request.client_name],
    ["PAN", original.pan || request.pan],
    ["CKYC No.", original.ckycNo || "-"],
    ["Date", new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })],
  ];
  for (const [label, value] of meta) {
    text(`${label}:`, { f: bold, size: 9.5 });
    text(value, { x: MARGIN + 95, size: 9.5 });
    y -= 15;
  }
  y -= 10;

  const cols = [
    { title: "Section", x: MARGIN, w: 62 },
    { title: "Field", x: MARGIN + 66, w: 110 },
    { title: "Existing details", x: MARGIN + 180, w: 165 },
    { title: "New details", x: MARGIN + 349, w: 166 },
  ];
  const tableRight = A4[0] - MARGIN;
  const header = () => {
    page.drawRectangle({ x: MARGIN - 4, y: y - 5, width: tableRight - MARGIN + 8, height: 18, color: rgb(0.93, 0.95, 0.99) });
    cols.forEach((c) => page.drawText(c.title, { x: c.x, y, size: 9, font: bold, color: DARK }));
    y -= 20;
  };
  header();

  for (const row of listChanges(request.changes)) {
    const cells = [row.section, row.field, row.oldValue, row.newValue].map((v, i) => wrap(v, font, 8.5, cols[i].w - 10));
    const height = Math.max(...cells.map((c) => c.length)) * 11 + 6;
    if (y - height < MARGIN + 60) {
      newPage();
      header();
    }
    cells.forEach((lines, i) => lines.forEach((line, li) => page.drawText(line, { x: cols[i].x, y: y - li * 11, size: 8.5, font, color: DARK })));
    y -= height;
    page.drawLine({ start: { x: MARGIN - 4, y: y + 8 }, end: { x: tableRight + 4, y: y + 8 }, thickness: 0.5, color: LINE });
  }

  const documents = request.documents || {};
  const attached = [
    documents.nameProof?.url && `Name change proof (${documents.nameProof.type || "document"})`,
    documents.financialProof?.url && `Financial proof (${documents.financialProof.type || "document"})`,
    request.selfie?.status === "passed" && "Live selfie with liveness and face match",
    request.verifications?.digilocker?.completedAt && "Aadhaar via DigiLocker",
  ].filter(Boolean);
  y -= 10;
  ensure(30 + attached.length * 13);
  text("Verifications / documents attached", { f: bold, size: 10 });
  y -= 15;
  for (const item of attached.length ? attached : ["None"]) {
    text(`- ${item}`, { size: 9, color: MUTED });
    y -= 13;
  }

  const declarations = [
    "I hereby request Stockology Securities Pvt. Ltd. to modify my account details as stated above.",
    "My sole country of tax residency is India. I have understood the FATCA & CRS requirements and confirm that the information provided is true, correct and complete.",
    "I agree to receive contract notes, statements and other communication electronically on my registered contact details.",
    "I understand that changes to e-mail and mobile number take up to 48 hours to reflect after verification.",
  ];
  y -= 12;
  ensure(30);
  text("Declaration", { f: bold, size: 10 });
  y -= 15;
  for (const declaration of declarations) {
    const lines = wrap(declaration, font, 9, A4[0] - 2 * MARGIN);
    ensure(lines.length * 12 + 4);
    lines.forEach((line) => {
      text(line, { size: 9, color: MUTED });
      y -= 12;
    });
    y -= 4;
  }

  y -= 20;
  ensure(40);
  text("Signature of the client (Aadhaar eSign):", { f: bold, size: 9.5 });

  return Buffer.from(await pdf.save());
}

module.exports = { buildModificationPdf };
