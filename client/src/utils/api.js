/**
 * API Client Utility
 *
 * Communicates with the Express backend for accessibility scans and health checks.
 */

const API_BASE_URL = "http://localhost:5000/api";

export async function checkApiHealth() {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }
  return response.json();
}

export async function runScan({ url, multiPage = false, maxPages = 5 }) {
  const response = await fetch(`${API_BASE_URL}/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ url, multiPage, maxPages })
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.error || `Scan request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    throw err;
  }

  return data;
}
