const express = require('express');
const router = express.Router();
const { getTemplates, getActiveTemplate, saveTemplate, uploadBasePdf } = require('../controllers/pdfTemplateController');
const { auth, adminAuth } = require('../middlewares/auth');
const localUpload = require('../middlewares/localUpload');

router.get('/', adminAuth, getTemplates);
router.get('/active', auth, getActiveTemplate);
router.post('/', adminAuth, saveTemplate);
router.post('/upload-base', adminAuth, localUpload.single('file'), uploadBasePdf);

module.exports = router;
