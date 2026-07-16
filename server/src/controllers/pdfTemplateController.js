const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { convertHtmlToPdf, convertDocxToPdf } = require('../utils/documentConverter');
const getTemplates = async (req, res) => {
  try {
    const templates = await prisma.pdfTemplate.findMany();
    res.status(200).json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
};

const getActiveTemplate = async (req, res) => {
  try {
    const template = await prisma.pdfTemplate.findFirst({
      where: { isActive: true }
    });
    res.status(200).json(template);
  } catch (error) {
    console.error('Error fetching active template:', error);
    res.status(500).json({ error: 'Failed to fetch active template' });
  }
};

const saveTemplate = async (req, res) => {
  try {
    const { name, basePdfUrl, isActive, pages, compilePdf } = req.body;
    let fields = req.body.fields;
    
    // First, if this one is being set to active, deactivate others
    if (isActive) {
      await prisma.pdfTemplate.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });
    }

    let finalBasePdfUrl = basePdfUrl;
    
    // If pages array exists, and compilePdf is true, we compile the mixed pages into a single PDF
    if (compilePdf && pages && pages.length > 0) {
      const finalPdfDoc = await PDFDocument.create();
      
      let basePdfDoc = null;
      if (basePdfUrl) {
         let baseFilePath = '';
         if (basePdfUrl.startsWith('/uploads/')) {
           baseFilePath = path.join(__dirname, '../../uploads', basePdfUrl.replace('/uploads/', ''));
         } else {
           baseFilePath = path.join(__dirname, '../../', basePdfUrl);
         }
         try {
           const basePdfBytes = fs.readFileSync(baseFilePath);
           basePdfDoc = await PDFDocument.load(basePdfBytes);
         } catch (e) { console.error("Could not load base PDF", e); }
      }

      let currentPhysicalPage = 1;
      const visualToPhysicalPageMap = {}; // Maps visual page (1-indexed) to new physical page (1-indexed)

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        visualToPhysicalPageMap[i + 1] = currentPhysicalPage;

        if (page.type === 'pdf' && basePdfDoc) {
          // pageNumberInSource is 1-indexed
          const [copiedPage] = await finalPdfDoc.copyPages(basePdfDoc, [page.pageNumberInSource - 1]);
          finalPdfDoc.addPage(copiedPage);
          currentPhysicalPage += 1;
        } else if (page.type === 'html') {
          // Convert HTML to a temporary PDF
          const tempPdfFilename = `${Date.now()}-temp.pdf`;
          const tempPdfPath = path.join(__dirname, '../../uploads', tempPdfFilename);
          await convertHtmlToPdf(page.content, tempPdfPath);
          
          const tempPdfBytes = fs.readFileSync(tempPdfPath);
          const tempPdfDoc = await PDFDocument.load(tempPdfBytes);
          
          const numGeneratedPages = tempPdfDoc.getPageCount();
          const copiedPages = await finalPdfDoc.copyPages(tempPdfDoc, tempPdfDoc.getPageIndices());
          copiedPages.forEach(p => finalPdfDoc.addPage(p));
          
          currentPhysicalPage += numGeneratedPages;
          fs.unlinkSync(tempPdfPath);
        }
      }
      
      // Update fields with new physical page numbers so they don't get lost on blank overflow pages
      if (fields && Array.isArray(fields)) {
        fields = fields.map(f => {
          if (f.page && visualToPhysicalPageMap[f.page]) {
            return { ...f, page: visualToPhysicalPageMap[f.page] };
          }
          return f;
        });
      }
      
      const newPdfBytes = await finalPdfDoc.save();
      const newFilename = `${Date.now()}-master.pdf`;
      const newPath = path.join(__dirname, '../../uploads', newFilename);
      fs.writeFileSync(newPath, newPdfBytes);
      finalBasePdfUrl = `/uploads/${newFilename}`;
    }

    // Build backward-compatible fields payload
    let finalPages = pages || [];
    if (compilePdf && pages && pages.length > 0) {
      // Once compiled, the document becomes a flat PDF. 
      // We reset pages so the frontend knows to just load the new physical PDF pages.
      finalPages = [];
    }
    
    const fieldsPayload = {
       variables: fields,
       pages: finalPages
    };

    const template = await prisma.pdfTemplate.upsert({
      where: { name: name || 'Default Template' },
      update: {
        fields: JSON.stringify(fieldsPayload),
        basePdfUrl: finalBasePdfUrl || 'public/official_form.pdf',
        isActive: isActive !== undefined ? isActive : true
      },
      create: {
        name: name || 'Default Template',
        fields: JSON.stringify(fieldsPayload),
        basePdfUrl: finalBasePdfUrl || 'public/official_form.pdf',
        isActive: isActive !== undefined ? isActive : true
      }
    });
    
    res.status(200).json({ message: 'Template saved successfully', template });
  } catch (error) {
    console.error('Error saving template:', error);
    res.status(500).json({ error: 'Failed to save template' });
  }
};

const uploadBasePdf = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    let finalPath = req.file.path;
    let finalFilename = req.file.filename;

    const mimeType = req.file.mimetype;
    
    if (mimeType === 'text/html' || mimeType === 'application/msword' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const pdfFilename = `${path.parse(req.file.filename).name}.pdf`;
      const pdfPath = path.join(req.file.destination, pdfFilename);
      
      if (mimeType === 'text/html') {
        const htmlContent = fs.readFileSync(req.file.path, 'utf8');
        await convertHtmlToPdf(htmlContent, pdfPath);
      } else {
        await convertDocxToPdf(req.file.path, pdfPath);
      }
      
      finalPath = pdfPath;
      finalFilename = pdfFilename;
      
      // Optionally remove the original uploaded file
      fs.unlinkSync(req.file.path);
    }

    const url = `/uploads/${finalFilename}`;
    res.json({ url });
  } catch (error) {
    console.error("Upload base PDF error:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const replacePage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No replacement file uploaded' });
    }
    
    const { basePdfUrl, pageIndex } = req.body;
    if (!basePdfUrl || pageIndex === undefined) {
      return res.status(400).json({ error: 'Missing basePdfUrl or pageIndex' });
    }

    // Convert replacement file to PDF if needed
    let replacementPdfPath = req.file.path;
    const mimeType = req.file.mimetype;

    if (mimeType === 'text/html' || mimeType === 'application/msword' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const pdfFilename = `${path.parse(req.file.filename).name}.pdf`;
      replacementPdfPath = path.join(req.file.destination, pdfFilename);
      
      if (mimeType === 'text/html') {
        const htmlContent = fs.readFileSync(req.file.path, 'utf8');
        await convertHtmlToPdf(htmlContent, replacementPdfPath);
      } else {
        await convertDocxToPdf(req.file.path, replacementPdfPath);
      }
      fs.unlinkSync(req.file.path);
    }

    // Load base PDF
    // basePdfUrl is like '/uploads/filename.pdf' or 'public/official_form.pdf'
    let baseFilePath = '';
    if (basePdfUrl.startsWith('/uploads/')) {
      baseFilePath = path.join(__dirname, '../../uploads', basePdfUrl.replace('/uploads/', ''));
    } else {
      baseFilePath = path.join(__dirname, '../../', basePdfUrl);
    }

    const basePdfBytes = fs.readFileSync(baseFilePath);
    const basePdfDoc = await PDFDocument.load(basePdfBytes);

    // Load replacement PDF
    const replacementPdfBytes = fs.readFileSync(replacementPdfPath);
    const replacementPdfDoc = await PDFDocument.load(replacementPdfBytes);

    // Remove the target page (pageIndex is 0-based)
    const targetIndex = parseInt(pageIndex);
    if (targetIndex >= 0 && targetIndex < basePdfDoc.getPageCount()) {
      basePdfDoc.removePage(targetIndex);
    }

    // Insert replacement pages
    const copiedPages = await basePdfDoc.copyPages(replacementPdfDoc, replacementPdfDoc.getPageIndices());
    for (let i = 0; i < copiedPages.length; i++) {
      // Insert pages at targetIndex, targetIndex+1, etc.
      const insertAt = Math.min(targetIndex + i, basePdfDoc.getPageCount());
      basePdfDoc.insertPage(insertAt, copiedPages[i]);
    }

    // Save compound PDF
    const modifiedPdfBytes = await basePdfDoc.save();
    
    // Save to a new file in uploads to avoid overwriting default templates, 
    // or just overwrite if it's already in uploads
    let newFilename = path.basename(baseFilePath);
    if (!basePdfUrl.startsWith('/uploads/')) {
       newFilename = `${Date.now()}-compound.pdf`;
    }
    const newPath = path.join(__dirname, '../../uploads', newFilename);
    fs.writeFileSync(newPath, modifiedPdfBytes);
    
    // Clean up temporary replacement pdf
    fs.unlinkSync(replacementPdfPath);

    res.json({ url: `/uploads/${newFilename}` });
  } catch (error) {
    console.error("Replace page error:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const mammoth = require('mammoth');

const convertToHtml = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const mimeType = req.file.mimetype;
    let htmlContent = '';

    if (mimeType === 'text/html') {
      let rawHtml = fs.readFileSync(req.file.path, 'utf8');
      
      // Extract contents of <body> and <style> if present, 
      // discarding <html> and <head> which break dangerouslySetInnerHTML
      const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const styleMatch = rawHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      
      if (bodyMatch) {
        let styles = styleMatch ? `<style>${styleMatch[1].replace(/\bbody\b/gi, '.kyc-template-body')}</style>` : '';
        htmlContent = `${styles}\n<div class="kyc-template-body" style="width:100%;min-height:100%;">${bodyMatch[1]}</div>`;
      } else {
        htmlContent = rawHtml;
      }
    } else if (mimeType === 'application/msword' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.convertToHtml({ path: req.file.path });
      htmlContent = `
        <div style="font-family: 'Helvetica', 'Arial', sans-serif; line-height: 1.6; color: #333; padding: 20px;">
          ${result.value}
        </div>
      `;
    } else {
       return res.status(400).json({ error: 'Unsupported file type for HTML conversion' });
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({ html: htmlContent });
  } catch (error) {
    console.error("Convert to HTML error:", error);
    res.status(500).json({ error: 'Internal server error during conversion' });
  }
};

module.exports = {
  getTemplates,
  getActiveTemplate,
  saveTemplate,
  uploadBasePdf,
  replacePage,
  convertToHtml
};
