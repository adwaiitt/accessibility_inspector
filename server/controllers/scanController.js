/**
 * Scan Controller
 *
 * Handles HTTP requests for website accessibility scanning,
 * validates incoming parameters, and invokes the scanService.
 */

const scanService = require("../services/scanService");

/**
 * Health check endpoint controller.
 */
function getHealth(req, res) {
  res.json({
    status: "success",
    message: "Backend API is connected successfully!"
  });
}

/**
 * Initiates an accessibility scan.
 */
async function startScan(req, res) {
  const { url, multiPage, maxPages } = req.body || {};

  if (!url || typeof url !== "string" || !url.trim()) {
    return res.status(400).json({
      error: "Website URL is required."
    });
  }

  try {
    const result = await scanService.scanWebsite({
      url: url.trim(),
      multiPage: Boolean(multiPage),
      maxPages: maxPages ? parseInt(maxPages, 10) : 5
    });

    return res.status(200).json(result);
  } catch (err) {
    // Known status codes from service (e.g., 400, 403, 429)
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        error: err.message
      });
    }

    // Timeout detection
    if (
      err.name === "TimeoutError" ||
      (err.message && err.message.toLowerCase().includes("timeout"))
    ) {
      return res.status(408).json({
        error: "Website scanning timed out. The site took too long to load or respond."
      });
    }

    // Generic error fallback without exposing internal stack traces
    console.error("Scan processing error:", err);
    return res.status(500).json({
      error: err.message || "An unexpected error occurred while analyzing the website."
    });
  }
}

module.exports = {
  getHealth,
  startScan
};
