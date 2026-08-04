const prisma = require("../config/db");
const fs = require("fs");

/**
 * Get paginated list of BOIDs
 */
const getBoids = async (req, res, next) => {
  const { page = 1, limit = 20, status = "all", search = "" } = req.query;
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const take = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
  const skip = (pageNum - 1) * take;

  try {
    const where = {};
    if (status !== "all") {
      where.status = status;
    }
    
    if (search) {
      where.boidNumber = { contains: search };
    }

    const [boids, total, statsCounts] = await Promise.all([
      prisma.boid.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { id: true, email: true, phone: true }
          }
        }
      }),
      prisma.boid.count({ where }),
      prisma.boid.groupBy({
        by: ['status'],
        _count: { status: true }
      })
    ]);

    const stats = {
      total: 0,
      available: 0,
      assigned: 0,
      cooling_period: 0
    };

    statsCounts.forEach(s => {
      stats[s.status] = s._count.status;
      stats.total += s._count.status;
    });

    res.json({
      success: true,
      boids,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / take),
      stats
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload BOID file (supports .txt with one number per line)
 */
const uploadBoids = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    // Split by newlines, trim, and filter out empty lines
    const rawNumbers = fileContent
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (rawNumbers.length === 0) {
      return res.status(400).json({ success: false, error: "File is empty or contains no valid numbers." });
    }

    // Prepare boid numbers with prefix
    const PREFIX = "IN300966";
    const boidsToInsert = new Set();
    
    rawNumbers.forEach(num => {
      // If the number already has the prefix, don't prepend it again
      const boidNum = num.toUpperCase().startsWith(PREFIX) ? num.toUpperCase() : `${PREFIX}${num}`;
      boidsToInsert.add(boidNum);
    });

    const uniqueBoids = Array.from(boidsToInsert);
    const dataToInsert = uniqueBoids.map(boidNumber => ({
      boidNumber,
      status: "available"
    }));

    const result = await prisma.boid.createMany({
      data: dataToInsert,
      skipDuplicates: true
    });

    const addedCount = result.count;
    // Calculate total duplicates (both inside the file itself AND existing in the database)
    const duplicateCount = rawNumbers.length - addedCount;

    // Clean up uploaded file
    try {
      fs.unlinkSync(req.file.path);
    } catch (e) {
      console.warn("Failed to delete temp file:", req.file.path);
    }

    res.json({
      success: true,
      message: `Successfully added ${addedCount} new BOIDs. ${duplicateCount} were duplicates.`,
      addedCount,
      duplicateCount
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Update BOID number
 */
const updateBoid = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { boidNumber } = req.body;

    if (!boidNumber || typeof boidNumber !== "string") {
      return res.status(400).json({ success: false, error: "Invalid BOID number" });
    }

    const trimmedNumber = boidNumber.trim().toUpperCase();

    // Check if it already exists
    const existing = await prisma.boid.findUnique({
      where: { boidNumber: trimmedNumber }
    });

    if (existing && existing.id !== id) {
      return res.status(400).json({ success: false, error: "This BOID number already exists" });
    }

    const updated = await prisma.boid.update({
      where: { id },
      data: { boidNumber: trimmedNumber }
    });

    res.json({ success: true, boid: updated, message: "BOID updated successfully" });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, error: "This BOID number already exists" });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, error: "BOID not found" });
    }
    return res.status(500).json({ success: false, error: error.message || "Internal server error" });
  }
};

module.exports = {
  getBoids,
  uploadBoids,
  updateBoid
};
