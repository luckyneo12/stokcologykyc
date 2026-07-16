const puppeteer = require('puppeteer');
const mammoth = require('mammoth');
const fs = require('fs').promises;
const path = require('path');

async function convertHtmlToPdf(htmlString, outputPath) {
  let browser;
  try {
    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    
    // Ensure the HTML string is wrapped in a proper document with resets
    // This prevents Puppeteer from adding default body margins (8px) which causes text wrapping
    // and ensures box-sizing matches the frontend.
    const fullHtml = htmlString.includes('<html') 
      ? htmlString 
      : `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body, html { 
                margin: 0; 
                padding: 0; 
                width: 100%; 
                height: 100%; 
                font-family: 'Helvetica', 'Arial', sans-serif;
                line-height: 1.5;
                color: #333;
              }
              * { box-sizing: border-box; }
            </style>
          </head>
          <body>
            ${htmlString}
          </body>
        </html>
      `;

    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    await page.pdf({ 
      path: outputPath, 
      format: 'A4',
      printBackground: true,
      margin: { top: '0px', bottom: '0px', left: '0px', right: '0px' }
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function convertDocxToPdf(docxPath, outputPath) {
  // Convert DOCX to HTML using mammoth
  const result = await mammoth.convertToHtml({ path: docxPath });
  const html = `
    <html>
      <head>
        <style>
          body { font-family: 'Helvetica', 'Arial', sans-serif; line-height: 1.6; color: #333; }
          img { max-width: 100%; height: auto; }
          table { border-collapse: collapse; width: 100%; }
          td, th { border: 1px solid #ddd; padding: 8px; }
        </style>
      </head>
      <body>
        ${result.value}
      </body>
    </html>
  `;
  
  // Convert the generated HTML to PDF
  await convertHtmlToPdf(html, outputPath);
}

module.exports = {
  convertHtmlToPdf,
  convertDocxToPdf
};
