/**
 * Scan Routes
 *
 * Defines API routing endpoints for health checks and accessibility audits.
 */

const express = require("express");
const router = express.Router();
const scanController = require("../controllers/scanController");

// Health check
router.get("/health", scanController.getHealth);

// Start scan
router.post("/scan", scanController.startScan);

module.exports = router;
