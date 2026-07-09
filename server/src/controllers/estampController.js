const prisma = require("../config/db");
const cloudinary = require('cloudinary').v2;
const fs = require('fs');


// ─── Controller Methods ────────────────────────────────────────────────────────

exports.uploadEStamp = async (req, res) => {
  try {
    const { certificateNo, serialNo } = req.body;
    
    if (!certificateNo && !serialNo) {
      return res.status(400).json({ success: false, error: "At least Certificate No or Serial No is required." });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: "E-Stamp file is required." });
    }

    // Check for duplicates at application level
    if (certificateNo) {
      const existingCert = await prisma.eStamp.findFirst({ where: { certificateNo } });
      if (existingCert) {
        return res.status(400).json({ success: false, error: `Certificate No ${certificateNo} already exists.` });
      }
    }
    if (serialNo) {
      const existingSerial = await prisma.eStamp.findFirst({ where: { serialNo } });
      if (existingSerial) {
        return res.status(400).json({ success: false, error: `Serial No ${serialNo} already exists.` });
      }
    }

    const fileUrl = req.file.path; // Cloudinary URL from uploadMiddleware

    const eStamp = await prisma.eStamp.create({
      data: {
        certificateNo: certificateNo || "",
        serialNo: serialNo || "",
        fileUrl,
        status: "available",
      },
    });

    res.json({ success: true, eStamp });
  } catch (error) {
    console.error("Error uploading E-Stamp:", error);
    res.status(500).json({ success: false, error: "Server error during upload." });
  }
};

exports.getEStamps = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const statusFilter = req.query.status || "";

    const whereClause = {};
    if (search) {
      whereClause.OR = [
        { certificateNo: { contains: search } },
        { serialNo: { contains: search } },
      ];
    }
    if (statusFilter && statusFilter !== "all") {
      whereClause.status = statusFilter;
    }

    const [eStamps, total] = await Promise.all([
      prisma.eStamp.findMany({
        where: whereClause,
        include: {
          user: {
            select: { 
              id: true, 
              phone: true,
              email: true,
              kycApplications: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { applicationId: true, personalDetails: true }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.eStamp.count({ where: whereClause })
    ]);

    // Parse user personalDetails to get name
    const formattedEStamps = eStamps.map(stamp => {
      let userName = "N/A";
      let kycApplicationId = null;
      if (stamp.user) {
        // Fallback to phone or email if name isn't found
        userName = stamp.user.email || stamp.user.phone || "N/A";
        if (stamp.user.kycApplications && stamp.user.kycApplications.length > 0) {
          kycApplicationId = stamp.user.kycApplications[0].applicationId;
          try {
            const details = JSON.parse(stamp.user.kycApplications[0].personalDetails);
            if (details && (details.fullName || details.name)) {
              userName = details.fullName || details.name;
            }
          } catch(e) {}
        }
      }
      return {
        ...stamp,
        userName,
        kycApplicationId
      };
    });

    res.json({
      success: true,
      eStamps: formattedEStamps,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching E-Stamps:", error);
    res.status(500).json({ success: false, error: "Server error fetching E-Stamps." });
  }
};

exports.getEStampStats = async (req, res) => {
  try {
    const [total, assigned, available] = await Promise.all([
      prisma.eStamp.count(),
      prisma.eStamp.count({ where: { status: "assigned" } }),
      prisma.eStamp.count({ where: { status: "available" } })
    ]);

    res.json({
      success: true,
      stats: {
        totalUploaded: total,
        totalUsed: assigned,
        totalLeft: available
      }
    });
  } catch (error) {
    console.error("Error fetching E-Stamp stats:", error);
    res.status(500).json({ success: false, error: "Server error fetching stats." });
  }
};

exports.bulkUploadEStamps = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: "No E-Stamp files provided." });
    }

    const files = [];

    for (const file of req.files) {
      try {
        const uploadResult = await cloudinary.uploader.upload(file.path, {
          folder: "kyc_uploads",
          resource_type: "auto"
        });
        
        files.push({
          originalName: file.originalname,
          fileUrl: uploadResult.secure_url
        });
      } catch (err) {
        console.error("[E-Stamp] Failed to upload to Cloudinary:", err.message);
      }
      
      // Clean up local file after processing
      try {
        fs.unlinkSync(file.path);
      } catch (e) {
        console.error("[E-Stamp] Failed to delete local temp file:", e.message);
      }
    }

    res.json({ success: true, files });
  } catch (error) {
    console.error("Error during bulk upload:", error);
    res.status(500).json({ success: false, error: "Server error during bulk upload." });
  }
};

/**
 * Check for duplicates before saving.
 * Accepts an array of { certificateNo, serialNo } and returns duplicate info.
 */
exports.checkDuplicates = async (req, res) => {
  try {
    const { stamps } = req.body; // Array of { certificateNo, serialNo }

    if (!stamps || !Array.isArray(stamps)) {
      return res.status(400).json({ success: false, error: "Invalid input." });
    }

    // Collect all non-empty certificate numbers and serial numbers
    const certNos = stamps
      .map(s => s.certificateNo)
      .filter(c => c && c.trim() !== "");
    
    const serialNos = stamps
      .map(s => s.serialNo)
      .filter(s => s && s.trim() !== "");

    // Query DB for existing matches
    const [existingCerts, existingSerials] = await Promise.all([
      certNos.length > 0
        ? prisma.eStamp.findMany({
            where: { certificateNo: { in: certNos } },
            select: { certificateNo: true, serialNo: true, status: true, id: true }
          })
        : [],
      serialNos.length > 0
        ? prisma.eStamp.findMany({
            where: { serialNo: { in: serialNos } },
            select: { certificateNo: true, serialNo: true, status: true, id: true }
          })
        : []
    ]);

    // Build lookup maps
    const duplicateCerts = new Set(existingCerts.map(e => e.certificateNo));
    const duplicateSerials = new Set(existingSerials.map(e => e.serialNo));

    // Also check for duplicates within the uploaded batch itself
    const batchCertCounts = {};
    const batchSerialCounts = {};
    for (const s of stamps) {
      if (s.certificateNo && s.certificateNo.trim() !== "") {
        batchCertCounts[s.certificateNo] = (batchCertCounts[s.certificateNo] || 0) + 1;
      }
      if (s.serialNo && s.serialNo.trim() !== "") {
        batchSerialCounts[s.serialNo] = (batchSerialCounts[s.serialNo] || 0) + 1;
      }
    }

    // Mark each stamp with duplicate info
    const results = stamps.map((s, idx) => {
      const isDuplicateCert = s.certificateNo && duplicateCerts.has(s.certificateNo);
      const isDuplicateSerial = s.serialNo && duplicateSerials.has(s.serialNo);
      const isBatchDuplicateCert = s.certificateNo && (batchCertCounts[s.certificateNo] || 0) > 1;
      const isBatchDuplicateSerial = s.serialNo && (batchSerialCounts[s.serialNo] || 0) > 1;

      const isDuplicate = isDuplicateCert || isDuplicateSerial;
      const isBatchDuplicate = isBatchDuplicateCert || isBatchDuplicateSerial;

      let duplicateReason = "";
      if (isDuplicateCert) duplicateReason = `Certificate No "${s.certificateNo}" already exists in database`;
      else if (isDuplicateSerial) duplicateReason = `Serial No "${s.serialNo}" already exists in database`;
      else if (isBatchDuplicateCert) duplicateReason = `Certificate No "${s.certificateNo}" appears multiple times in this batch`;
      else if (isBatchDuplicateSerial) duplicateReason = `Serial No "${s.serialNo}" appears multiple times in this batch`;

      return {
        index: idx,
        isDuplicate: isDuplicate || isBatchDuplicate,
        isDbDuplicate: isDuplicate,
        isBatchDuplicate: isBatchDuplicate,
        duplicateReason
      };
    });

    res.json({ success: true, results });
  } catch (error) {
    console.error("Error checking duplicates:", error);
    res.status(500).json({ success: false, error: "Server error checking duplicates." });
  }
};

exports.bulkSaveEStamps = async (req, res) => {
  try {
    const { eStamps } = req.body; // Array of { certificateNo, serialNo, fileUrl }

    if (!eStamps || !Array.isArray(eStamps) || eStamps.length === 0) {
      return res.status(400).json({ success: false, error: "No E-Stamps provided to save." });
    }

    const savedStamps = [];
    const errors = [];
    const skippedDuplicates = [];

    for (const stamp of eStamps) {
      if (!stamp.fileUrl) {
        errors.push({ stamp, error: "Missing file URL" });
        continue;
      }

      // At least one identifier should be present
      const hasCert = stamp.certificateNo && stamp.certificateNo.trim() !== "";
      const hasSerial = stamp.serialNo && stamp.serialNo.trim() !== "";

      if (!hasCert && !hasSerial) {
        errors.push({ stamp, error: "At least Certificate No or Serial No is required" });
        continue;
      }

      // Application-level duplicate check (only for non-empty fields)
      try {
        let isDuplicate = false;
        let dupReason = "";

        if (hasCert) {
          const existingCert = await prisma.eStamp.findFirst({
            where: { certificateNo: stamp.certificateNo.trim() }
          });
          if (existingCert) {
            isDuplicate = true;
            dupReason = `Duplicate Certificate No: ${stamp.certificateNo}`;
          }
        }

        if (!isDuplicate && hasSerial) {
          const existingSerial = await prisma.eStamp.findFirst({
            where: { serialNo: stamp.serialNo.trim() }
          });
          if (existingSerial) {
            isDuplicate = true;
            dupReason = `Duplicate Serial No: ${stamp.serialNo}`;
          }
        }

        if (isDuplicate) {
          skippedDuplicates.push({ stamp, error: dupReason });
          continue;
        }

        const newStamp = await prisma.eStamp.create({
          data: {
            certificateNo: hasCert ? stamp.certificateNo.trim() : "",
            serialNo: hasSerial ? stamp.serialNo.trim() : "",
            fileUrl: stamp.fileUrl,
            status: "available",
          },
        });
        savedStamps.push(newStamp);
      } catch (dbError) {
        errors.push({ stamp, error: dbError.message });
      }
    }

    res.json({ 
      success: true, 
      savedCount: savedStamps.length,
      duplicateCount: skippedDuplicates.length,
      errorCount: errors.length,
      errors,
      skippedDuplicates,
      message: `Saved ${savedStamps.length} E-Stamps. ${skippedDuplicates.length} duplicates skipped. ${errors.length} errors.`
    });
  } catch (error) {
    console.error("Error saving bulk E-Stamps:", error);
    res.status(500).json({ success: false, error: "Server error saving E-Stamps." });
  }
};

exports.updateEStamp = async (req, res) => {
  try {
    const { id } = req.params;
    const { certificateNo, serialNo } = req.body;

    const existing = await prisma.eStamp.findUnique({ where: { id: parseInt(id) } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "E-Stamp not found" });
    }

    if (existing.status !== "available") {
      return res.status(400).json({ success: false, error: "Cannot edit an assigned E-Stamp." });
    }

    // Application-level duplicate check for updated values
    const newCert = certificateNo || existing.certificateNo;
    const newSerial = serialNo || existing.serialNo;

    if (newCert && newCert !== existing.certificateNo) {
      const dupCert = await prisma.eStamp.findFirst({
        where: { certificateNo: newCert, id: { not: parseInt(id) } }
      });
      if (dupCert) {
        return res.status(400).json({ success: false, error: `Certificate No ${newCert} already exists.` });
      }
    }

    if (newSerial && newSerial !== existing.serialNo) {
      const dupSerial = await prisma.eStamp.findFirst({
        where: { serialNo: newSerial, id: { not: parseInt(id) } }
      });
      if (dupSerial) {
        return res.status(400).json({ success: false, error: `Serial No ${newSerial} already exists.` });
      }
    }

    const updated = await prisma.eStamp.update({
      where: { id: parseInt(id) },
      data: {
        certificateNo: newCert,
        serialNo: newSerial
      }
    });

    res.json({ success: true, eStamp: updated });
  } catch (error) {
    console.error("Update EStamp Error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

exports.deleteEStamp = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.eStamp.findUnique({ where: { id: parseInt(id) } });
    
    if (!existing) {
      return res.status(404).json({ success: false, error: "E-Stamp not found" });
    }

    if (existing.status !== "available") {
      return res.status(400).json({ success: false, error: "Cannot delete an assigned E-Stamp." });
    }

    await prisma.eStamp.delete({ where: { id: parseInt(id) } });

    res.json({ success: true, message: "E-Stamp deleted successfully" });
  } catch (error) {
    console.error("Delete EStamp Error:", error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};
