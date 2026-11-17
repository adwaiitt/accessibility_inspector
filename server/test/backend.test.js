/**
 * Automated Verification Test Suite for Backend & Accessibility Engine
 */

const http = require("http");

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({ status: res.statusCode, data: json });
      });
    });

    req.on("error", (err) => reject(err));

    if (postData) {
      req.write(typeof postData === "string" ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runSuite() {
  console.log("=== RUNNING BACKEND ACCESSIBILITY INSPECTOR TEST SUITE ===\n");
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`✗ FAIL: ${name}`);
      console.error(`  Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Health check
  await test("GET /api/health returns 200 and success status", async () => {
    const res = await makeRequest({
      hostname: "localhost",
      port: 5000,
      path: "/api/health",
      method: "GET"
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.data?.status !== "success") throw new Error("Expected status: success");
  });

  // 2. Empty URL rejection
  await test("POST /api/scan rejects missing/empty URL with 400", async () => {
    const res = await makeRequest(
      {
        hostname: "localhost",
        port: 5000,
        path: "/api/scan",
        method: "POST",
        headers: { "Content-Type": "application/json" }
      },
      {}
    );
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // 3. Unsupported protocol
  await test("POST /api/scan rejects ftp:// protocol with 400", async () => {
    const res = await makeRequest(
      {
        hostname: "localhost",
        port: 5000,
        path: "/api/scan",
        method: "POST",
        headers: { "Content-Type": "application/json" }
      },
      { url: "ftp://example.com" }
    );
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // 4. Localhost rejection
  await test("POST /api/scan blocks localhost (SSRF protection) with 403", async () => {
    const res = await makeRequest(
      {
        hostname: "localhost",
        port: 5000,
        path: "/api/scan",
        method: "POST",
        headers: { "Content-Type": "application/json" }
      },
      { url: "http://localhost:5000" }
    );
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  // 5. Private IP 192.168.x.x rejection
  await test("POST /api/scan blocks private IPv4 192.168.1.1 with 403", async () => {
    const res = await makeRequest(
      {
        hostname: "localhost",
        port: 5000,
        path: "/api/scan",
        method: "POST",
        headers: { "Content-Type": "application/json" }
      },
      { url: "http://192.168.1.1" }
    );
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  // 6. Cloud metadata 169.254.169.254 rejection
  await test("POST /api/scan blocks cloud metadata IP 169.254.169.254 with 403", async () => {
    const res = await makeRequest(
      {
        hostname: "localhost",
        port: 5000,
        path: "/api/scan",
        method: "POST",
        headers: { "Content-Type": "application/json" }
      },
      { url: "http://169.254.169.254/latest/meta-data/" }
    );
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  // 7. Loopback 127.0.0.1 rejection
  await test("POST /api/scan blocks 127.0.0.1 with 403", async () => {
    const res = await makeRequest(
      {
        hostname: "localhost",
        port: 5000,
        path: "/api/scan",
        method: "POST",
        headers: { "Content-Type": "application/json" }
      },
      { url: "http://127.0.0.1:8080" }
    );
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  // 8. Non-existent domain DNS failure
  await test("POST /api/scan fails with 400 on unresolvable domain", async () => {
    const res = await makeRequest(
      {
        hostname: "localhost",
        port: 5000,
        path: "/api/scan",
        method: "POST",
        headers: { "Content-Type": "application/json" }
      },
      { url: "https://unresolvable-domain-xyz-nonexistent-12345.org" }
    );
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // 9. Real website scan on https://example.com
  await test("POST /api/scan scans https://example.com using Playwright & axe-core", async () => {
    const res = await makeRequest(
      {
        hostname: "localhost",
        port: 5000,
        path: "/api/scan",
        method: "POST",
        headers: { "Content-Type": "application/json" }
      },
      { url: "https://example.com" }
    );
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const data = res.data;
    if (!data.scanId) throw new Error("Missing scanId");
    if (typeof data.score !== "number" || data.score < 0 || data.score > 100) {
      throw new Error(`Invalid score: ${data.score}`);
    }
    if (!Array.isArray(data.violations) || data.violations.length === 0) {
      throw new Error("Expected violations array from axe-core");
    }
    if (data.totalPassed < 1) {
      throw new Error("Expected passed checks count");
    }
  });

  // 10. Multi-page scan option
  await test("POST /api/scan handles multiPage crawling parameter", async () => {
    const res = await makeRequest(
      {
        hostname: "localhost",
        port: 5000,
        path: "/api/scan",
        method: "POST",
        headers: { "Content-Type": "application/json" }
      },
      { url: "https://example.com", multiPage: true, maxPages: 2 }
    );
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.data?.isMultiPage !== true) throw new Error("Expected isMultiPage: true");
  });

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) process.exit(1);
}

runSuite().catch((err) => {
  console.error("Suite execution error:", err);
  process.exit(1);
});
