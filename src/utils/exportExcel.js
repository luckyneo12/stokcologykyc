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
