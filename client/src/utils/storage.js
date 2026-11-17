/**
 * LocalStorage Service for Accessibility Scan History
 *
 * Safely persists and retrieves completed scans from browser localStorage.
 */

const STORAGE_KEY = "accessibility_inspector_scans";
const MAX_STORED_SCANS = 50;

/**
 * Retrieves all stored scans from localStorage, sorted by newest first.
 *
 * @returns {Array<Object>} List of scans
 */
export function getScanHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("Failed to parse scan history from localStorage:", err);
    return [];
  }
}

/**
 * Saves a new scan result to localStorage.
 *
 * @param {Object} scan - Scan result object
 * @returns {Array<Object>} Updated list of scans
 */
export function saveScan(scan) {
  if (!scan || !scan.scanId) return getScanHistory();

  try {
    const history = getScanHistory();
    // Prepend new scan, filter out duplicates if any
    const updated = [scan, ...history.filter((s) => s.scanId !== scan.scanId)];
    // Cap at MAX_STORED_SCANS to prevent exceeding localStorage quota
    const trimmed = updated.slice(0, MAX_STORED_SCANS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    return trimmed;
  } catch (err) {
    console.error("Failed to save scan to localStorage:", err);
    return getScanHistory();
  }
}

/**
 * Retrieves a single scan by ID.
 *
 * @param {string} scanId
 * @returns {Object|null}
 */
export function getScanById(scanId) {
  const history = getScanHistory();
  return history.find((s) => s.scanId === scanId) || null;
}

/**
 * Deletes a scan by its ID.
 *
 * @param {string} scanId
 * @returns {Array<Object>} Updated list of scans
 */
export function deleteScan(scanId) {
  try {
    const history = getScanHistory();
    const updated = history.filter((s) => s.scanId !== scanId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error("Failed to delete scan from localStorage:", err);
    return getScanHistory();
  }
}

/**
 * Clears all scan history.
 */
export function clearAllScans() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  } catch (err) {
    console.error("Failed to clear scan history:", err);
    return [];
  }
}
