const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
    const { name, fields, basePdfUrl, isActive } = req.body;
    
    // First, if this one is being set to active, deactivate others
    if (isActive) {
      await prisma.pdfTemplate.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });
    }

    const template = await prisma.pdfTemplate.upsert({
      where: { name: name || 'Default Template' },
      update: {
        fields: JSON.stringify(fields),
        basePdfUrl: basePdfUrl || 'public/official_form.pdf',
        isActive: isActive !== undefined ? isActive : true
      },
      create: {
        name: name || 'Default Template',
        fields: JSON.stringify(fields),
        basePdfUrl: basePdfUrl || 'public/official_form.pdf',
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
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
  } catch (error) {
    console.error("Upload base PDF error:", error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getTemplates,
  getActiveTemplate,
  saveTemplate,
  uploadBasePdf
};
