// Builds an .xlsx file in the browser and downloads it. exceljs is only loaded when an export runs,
// so it doesn't add to the page's initial load.
export async function downloadExcel(fileName, headers, rows, sheetName = "KYC") {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] });

  sheet.addRow(headers);
  // Values stay as they are shown in the table (account / phone numbers remain text, not numbers)
  rows.forEach((row) => sheet.addRow(row.map((v) => (v === null || v === undefined ? "" : v))));
  sheet.getRow(1).font = { bold: true };

  // Column width from the longest value, within sensible limits
  headers.forEach((header, i) => {
    let longest = String(header ?? "").length;
    for (const row of rows) longest = Math.max(longest, String(row[i] ?? "").length);
    sheet.getColumn(i + 1).width = Math.min(Math.max(longest + 2, 10), 60);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Group colours for the grouped export (band row) — dark fill + white text, light fill for the headers
const GROUP_COLOURS = [
  ["1F4E78", "DDEBF7"], ["375623", "E2EFDA"], ["7F6000", "FFF2CC"], ["833C0B", "FCE4D6"],
  ["3A3838", "EDEDED"], ["203864", "D9E1F2"], ["525252", "F2F2F2"], ["806000", "FFE699"],
];

/**
 * .xlsx with columns GROUPED by topic: row 1 names each group (merged across its columns), row 2 holds
 * the column headers. groups = [{ name, columns: [header, …] }]; rows = arrays in the same column order.
 * Web links become clickable "Open" links. The first two columns (S.No., KYC ID) stay visible while scrolling.
 */
export async function downloadGroupedExcel(fileName, groups, rows, sheetName = "KYC") {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", xSplit: 2, ySplit: 2 }] });

  const headers = groups.flatMap((g) => g.columns);
  sheet.addRow(groups.flatMap((g) => g.columns.map((_, i) => (i === 0 ? g.name : ""))));
  sheet.addRow(headers);

  let col = 1;
  groups.forEach((g, gi) => {
    const [dark, light] = GROUP_COLOURS[gi % GROUP_COLOURS.length];
    const start = col;
    const end = col + g.columns.length - 1;
    if (end > start) sheet.mergeCells(1, start, 1, end);
    const band = sheet.getCell(1, start);
    band.font = { bold: true, color: { argb: "FFFFFFFF" } };
    band.alignment = { horizontal: "center", vertical: "middle" };
    for (let c = start; c <= end; c++) {
      sheet.getCell(1, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${dark}` } };
      const h = sheet.getCell(2, c);
      h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${light}` } };
      h.font = { bold: true };
      h.alignment = { wrapText: true, vertical: "middle" };
      // a clear line where each group starts
      if (c === start) h.border = { left: { style: "medium", color: { argb: `FF${dark}` } } };
    }
    col = end + 1;
  });
  sheet.getRow(1).height = 20;
  sheet.getRow(2).height = 32;

  rows.forEach((row) => {
    const added = sheet.addRow(row.map((v) => (v === null || v === undefined ? "" : v)));
    row.forEach((v, i) => {
      if (typeof v === "string" && /^https?:\/\//i.test(v)) {
        const cell = added.getCell(i + 1);
        cell.value = { text: "Open", hyperlink: v };
        cell.font = { color: { argb: "FF0563C1" }, underline: true };
      }
    });
  });
  sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: headers.length } };

  // Width from the header and the longest value (links count as "Open"), within sensible limits
  headers.forEach((header, i) => {
    let longest = Math.min(String(header ?? "").length, 28);
    for (const row of rows) {
      const v = row[i];
      const len = typeof v === "string" && /^https?:\/\//i.test(v) ? 4 : String(v ?? "").length;
      if (len > longest) longest = len;
    }
    sheet.getColumn(i + 1).width = Math.min(Math.max(longest + 2, 10), 50);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
