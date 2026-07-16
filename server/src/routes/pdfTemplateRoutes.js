const express = require('express');
const router = express.Router();
const { getTemplates, getActiveTemplate, saveTemplate, uploadBasePdf, replacePage, convertToHtml } = require('../controllers/pdfTemplateController');
const { auth, adminAuth } = require('../middlewares/auth');
const localUpload = require('../middlewares/localUpload');

router.get('/', adminAuth, getTemplates);
router.get('/active', auth, getActiveTemplate);
router.post('/', adminAuth, saveTemplate);
router.post('/upload-base', adminAuth, localUpload.single('file'), uploadBasePdf);
router.post('/replace-page', adminAuth, localUpload.single('file'), replacePage);
router.post('/convert-to-html', adminAuth, localUpload.single('file'), convertToHtml);

module.exports = router;
