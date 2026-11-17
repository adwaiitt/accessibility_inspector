/**
 * Accessibility Scanning Service
 *
 * Automates Chromium via Playwright, enforces network-level SSRF safeguards,
 * injects axe-core to evaluate WCAG compliance, and calculates a normalized
 * weighted accessibility score.
 */

const { chromium } = require("playwright");
const axeCore = require("axe-core");
const net = require("net");
const { validateUrl, isBlockedIp } = require("../utils/urlValidator");

// Active scan counter for concurrency control
let activeScans = 0;
const MAX_CONCURRENT_SCANS = parseInt(process.env.MAX_CONCURRENT_SCANS, 10) || 2;
const DEFAULT_TIMEOUT_MS = parseInt(process.env.SCAN_TIMEOUT_MS, 10) || 30000;

/**
 * Scoring Formula:
 * - Starting Base Score: 100
 * - Deductions applied per violation rule and affected nodes:
 *   - Critical: 10 base penalty + (2 pts * node count), capped at 25 pts per rule.
 *   - Serious:   6 base penalty + (1.5 pts * node count), capped at 18 pts per rule.
 *   - Moderate:  3 base penalty + (1 pt * node count), capped at 12 pts per rule.
 *   - Minor:     1 base penalty + (0.5 pt * node count), capped at 6 pts per rule.
 * - Final score is clamped between 0 and 100.
 *
 * If 0 violations are detected, score is 100.
 */
function calculateAccessibilityScore(violations) {
  if (!violations || violations.length === 0) {
    return 100;
  }

  let totalDeduction = 0;

  for (const violation of violations) {
    const impact = (violation.impact || "minor").toLowerCase();
    const nodeCount = Array.isArray(violation.nodes) ? violation.nodes.length : 1;

    let penalty = 0;
    switch (impact) {
      case "critical":
        penalty = Math.min(25, 10 + nodeCount * 2);
        break;
      case "serious":
        penalty = Math.min(18, 6 + nodeCount * 1.5);
        break;
      case "moderate":
        penalty = Math.min(12, 3 + nodeCount * 1);
        break;
      case "minor":
      default:
        penalty = Math.min(6, 1 + nodeCount * 0.5);
        break;
    }
    totalDeduction += penalty;
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(100 - totalDeduction)));
  return finalScore;
}

/**
 * Sanitizes and truncates HTML snippet strings to prevent XSS and excessive payloads.
 */
function sanitizeSnippet(snippet) {
  if (!snippet || typeof snippet !== "string") return "";
  const trimmed = snippet.trim();
  const maxLen = 300;
  if (trimmed.length > maxLen) {
    return trimmed.slice(0, maxLen) + "...";
  }
  return trimmed;
}

// Remediation mapping for standard axe-core rules
const RULE_REMEDIATION_MAP = {
  "color-contrast": {
    issue: "Text elements lack sufficient color contrast against their background.",
    fix: "Adjust foreground text or background colors to achieve a contrast ratio of at least 4.5:1 for standard text and 3:1 for large text (WCAG 1.4.3 AA)."
  },
  "page-has-heading-one": {
    issue: "Page is missing a top-level level-one heading (<h1>).",
    fix: "Add an <h1> heading to the document to identify the main topic or title of the page."
  },
  "landmark-one-main": {
    issue: "Document lacks a primary <main> landmark element.",
    fix: "Wrap the primary page content inside a <main> element or assign role=\"main\" to the container."
  },
  "region": {
    issue: "Page content is not contained within landmark regions.",
    fix: "Organize page layout into standard HTML5 landmark elements such as <header>, <nav>, <main>, <aside>, and <footer>."
  },
  "image-alt": {
    issue: "Image element is missing an alt attribute.",
    fix: "Add a descriptive alt=\"...\" attribute for informative images, or alt=\"\" for decorative images."
  },
  "button-name": {
    issue: "Button does not have readable accessible text.",
    fix: "Add visible text inside the <button> element or provide an aria-label describing the action."
  },
  "link-name": {
    issue: "Hyperlink lacks discernible accessible text.",
    fix: "Add descriptive text inside the <a> element or provide an aria-label describing the link destination."
  },
  "html-has-lang": {
    issue: "The <html> element is missing a valid lang attribute.",
    fix: "Add the lang attribute to the <html> tag, for example: <html lang=\"en\">."
  },
  "html-lang-valid": {
    issue: "The <html> element lang attribute has an invalid BCP 47 language code.",
    fix: "Update the lang attribute to use a standard valid language code, such as 'en', 'es', or 'fr'."
  },
  "document-title": {
    issue: "The document is missing a <title> element or the title is empty.",
    fix: "Add a descriptive <title> tag inside the <head> element to identify the page."
  },
  "label": {
    issue: "Form control is missing an accessible label.",
    fix: "Pair each form control with a <label for=\"id\"> matching the input's id, or provide an aria-label."
  },
  "meta-viewport": {
    issue: "Meta viewport restricts zooming or disables text scaling.",
    fix: "Remove user-scalable=no and ensure maximum-scale is at least 5 in <meta name=\"viewport\">."
  },
  "aria-allowed-attr": {
    issue: "Element uses ARIA attributes that are not allowed for its role.",
    fix: "Remove unsupported ARIA attributes or change the element role to one that permits them."
  },
  "aria-required-attr": {
    issue: "Element has an ARIA role but is missing required ARIA attributes.",
    fix: "Add all required ARIA attributes defined by the W3C specification for this role."
  },
  "aria-valid-attr-value": {
    issue: "ARIA attribute has an invalid or unparseable value.",
    fix: "Update the ARIA attribute value to conform to valid syntax and expected tokens."
  },
  "duplicate-id": {
    issue: "Multiple elements on the page share the same id attribute.",
    fix: "Ensure each id attribute value is unique across the entire HTML document."
  },
  "heading-order": {
    issue: "Heading levels do not follow a logical sequential order.",
    fix: "Ensure heading tags increase sequentially (e.g. <h1> to <h2>) without skipping levels."
  },
  "bypass": {
    issue: "Page does not provide a mechanism to skip repeated blocks of navigation.",
    fix: "Add a 'Skip to main content' link as the first focusable element, or use proper landmark regions."
  },
  "list": {
    issue: "List element contains elements other than <li> items.",
    fix: "Ensure <ul> and <ol> containers only hold <li> elements."
  },
  "listitem": {
    issue: "List item (<li>) is not contained directly within a <ul> or <ol> parent.",
    fix: "Wrap <li> elements inside a <ul> or <ol> list container."
  },
  "svg-img-alt": {
    issue: "SVG image element lacks an accessible text alternative.",
    fix: "Add a <title> element inside the <svg> or provide an aria-label on the svg element."
  },
  "target-size": {
    issue: "Interactive touch target size is too small.",
    fix: "Increase clickable/tappable area to at least 24x24 CSS pixels (or 44x44 for WCAG AAA)."
  },
  "empty-heading": {
    issue: "Heading element contains no text or discernible content.",
    fix: "Add descriptive text inside the heading element or remove the empty heading."
  }
};

function getRuleRemediation(v) {
  if (RULE_REMEDIATION_MAP[v.id]) {
    return RULE_REMEDIATION_MAP[v.id];
  }

  let issue = v.help || v.description;
  if (issue.toLowerCase().startsWith("ensure that ")) {
    issue = "Requirement not met: " + issue.substring(12);
  } else if (issue.toLowerCase().startsWith("ensure ")) {
    issue = "Requirement not met: " + issue.substring(7);
  }

  const fix = v.description || v.help || "Update the element markup to comply with WCAG guidelines.";
  return { issue, fix };
}

function cleanFailureSummary(summary) {
  if (!summary || typeof summary !== "string") return "";
  return summary
    .replace(/^Fix (all|any) of the following:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes raw axe-core violation records into a safe, client-friendly structure.
 */
function normalizeViolations(violations) {
  if (!Array.isArray(violations)) return [];

  return violations.map((v) => {
    const remediation = getRuleRemediation(v);
    return {
      id: v.id,
      impact: v.impact || "minor",
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      issue: remediation.issue,
      fix: remediation.fix,
      tags: v.tags || [],
      nodeCount: Array.isArray(v.nodes) ? v.nodes.length : 0,
      nodes: Array.isArray(v.nodes)
        ? v.nodes.slice(0, 15).map((node) => ({
            target: node.target || [],
            html: sanitizeSnippet(node.html),
            failureSummary: cleanFailureSummary(node.failureSummary || ""),
            fixSuggestion: remediation.fix
          }))
        : []
    };
  });
}

/**
 * Normalizes passed and incomplete rule checks.
 */
function normalizeRuleSummaries(rules) {
  if (!Array.isArray(rules)) return [];
  return rules.map((r) => ({
    id: r.id,
    description: r.description,
    help: r.help,
    helpUrl: r.helpUrl,
    tags: r.tags || [],
    impact: r.impact || null,
    nodeCount: Array.isArray(r.nodes) ? r.nodes.length : 0
  }));
}

/**
 * Attaches request routing to enforce SSRF policy on subresources and redirect navigations.
 */
async function setupPageSecurity(page) {
  await page.route("**", async (route) => {
    const request = route.request();
    const reqUrl = request.url();

    // Allow benign data and blob URIs for media/fonts
    if (reqUrl.startsWith("data:") || reqUrl.startsWith("blob:")) {
      return route.continue();
    }

    let parsed;
    try {
      parsed = new URL(reqUrl);
    } catch {
      return route.abort("blockedbyclient");
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return route.abort("blockedbyclient");
    }

    const host = parsed.hostname.toLowerCase();

    // Check if hostname is an IP or blocked hostname
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".internal") ||
      host.endsWith(".local") ||
      host.endsWith(".lan") ||
      host === "169.254.169.254"
    ) {
      return route.abort("blockedbyclient");
    }

    if (net.isIP(host) > 0) {
      const ipCheck = isBlockedIp(host);
      if (ipCheck.blocked) {
        return route.abort("blockedbyclient");
      }
    }

    return route.continue();
  });
}

/**
 * Executes an accessibility audit on a single URL.
 */
async function scanSinglePage(targetUrl, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const startTime = Date.now();
  let browser = null;
  let context = null;
  let page = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    });

    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 AccessibilityInspector/1.0",
      ignoreHTTPSErrors: false
    });

    page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);

    // Apply network SSRF filtering
    await setupPageSecurity(page);

    // Navigate to target URL
    const response = await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs
    });

    // Check for HTTP errors or missing response
    if (!response) {
      throw new Error("No response received from target website.");
    }

    const httpStatus = response.status();
    if (httpStatus >= 400) {
      throw new Error(`Website returned HTTP status ${httpStatus}.`);
    }

    // Give dynamic client-side scripts up to 5s to finish rendering
    await page.waitForLoadState("load", { timeout: 5000 }).catch(() => {});

    // Retrieve page title
    const pageTitle = (await page.title()) || targetUrl;

    // Inject axe-core
    await page.evaluate(axeCore.source);

    // Run axe accessibility audit
    const rawResults = await page.evaluate(async () => {
      // axe is injected into the window context
      return await window.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]
        }
      });
    });

    const scanDurationMs = Date.now() - startTime;
    const normalizedViolations = normalizeViolations(rawResults.violations);
    const normalizedPasses = normalizeRuleSummaries(rawResults.passes);
    const normalizedIncomplete = normalizeRuleSummaries(rawResults.incomplete);

    const score = calculateAccessibilityScore(normalizedViolations);

    // Calculate affected element count
    const totalAffectedElements = normalizedViolations.reduce(
      (acc, v) => acc + (v.nodeCount || 0),
      0
    );

    // Breakdown by impact
    const severityCounts = {
      critical: 0,
      serious: 0,
      moderate: 0,
      minor: 0
    };

    for (const v of normalizedViolations) {
      const imp = v.impact || "minor";
      if (severityCounts[imp] !== undefined) {
        severityCounts[imp]++;
      }
    }

    return {
      scanId: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      url: targetUrl,
      pageTitle,
      timestamp: new Date().toISOString(),
      scanDurationMs,
      score,
      totalViolations: normalizedViolations.length,
      totalPassed: normalizedPasses.length,
      totalIncomplete: normalizedIncomplete.length,
      totalAffectedElements,
      severityCounts,
      violations: normalizedViolations,
      passes: normalizedPasses,
      incomplete: normalizedIncomplete
    };
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * Extracts candidate internal same-origin links from a page.
 */
async function extractSameOriginLinks(page, baseUrl, maxLinks = 10) {
  try {
    const origin = new URL(baseUrl).origin;
    const rawLinks = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a[href]"));
      return anchors.map((a) => a.getAttribute("href"));
    });

    const linksSet = new Set();

    for (const raw of rawLinks) {
      if (!raw) continue;
      // Skip fragments, javascript, mailto, tel
      if (
        raw.startsWith("#") ||
        raw.startsWith("javascript:") ||
        raw.startsWith("mailto:") ||
        raw.startsWith("tel:")
      ) {
        continue;
      }

      try {
        const resolved = new URL(raw, baseUrl);
        // Only same origin
        if (resolved.origin === origin) {
          // Ignore hashes and common non-HTML files
          resolved.hash = "";
          const pathname = resolved.pathname.toLowerCase();
          if (
            !pathname.endsWith(".pdf") &&
            !pathname.endsWith(".zip") &&
            !pathname.endsWith(".png") &&
            !pathname.endsWith(".jpg") &&
            !pathname.endsWith(".jpeg") &&
            !pathname.endsWith(".svg") &&
            !pathname.endsWith(".mp4") &&
            !pathname.endsWith(".css") &&
            !pathname.endsWith(".js")
          ) {
            const cleanUrl = resolved.toString();
            if (cleanUrl !== baseUrl) {
              linksSet.add(cleanUrl);
            }
          }
        }
      } catch {
        // Invalid link, skip
      }

      if (linksSet.size >= maxLinks) break;
    }

    return Array.from(linksSet);
  } catch {
    return [];
  }
}

/**
 * Public service entry point. Handles concurrency and optional multi-page scanning.
 *
 * @param {Object} options
 * @param {string} options.url - The target URL to scan
 * @param {boolean} [options.multiPage=false] - Whether to crawl and scan linked pages
 * @param {number} [options.maxPages=5] - Maximum pages to scan (capped at 10)
 */
async function scanWebsite({ url, multiPage = false, maxPages = 5 }) {
  if (activeScans >= MAX_CONCURRENT_SCANS) {
    const err = new Error(
      "Server is currently handling maximum concurrent scans. Please try again in a few moments."
    );
    err.statusCode = 429;
    throw err;
  }

  // Pre-validate initial URL
  const validation = await validateUrl(url);
  if (!validation.valid) {
    const err = new Error(validation.error);
    err.statusCode = validation.error.includes("restricted") || validation.error.includes("blocked")
      ? 403
      : 400;
    throw err;
  }

  activeScans++;

  try {
    const initialResult = await scanSinglePage(url);

    // If single page scan requested, return immediate result
    if (!multiPage) {
      return initialResult;
    }

    // Bounded multi-page crawling
    const boundedMaxPages = Math.min(10, Math.max(1, parseInt(maxPages, 10) || 5));
    const pagesResults = [initialResult];
    const failedPages = [];

    // Quick crawl for candidate links using a temporary page context
    let candidateLinks = [];
    let crawlBrowser = null;
    try {
      crawlBrowser = await chromium.launch({ headless: true });
      const crawlPage = await crawlBrowser.newPage();
      await setupPageSecurity(crawlPage);
      await crawlPage.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
      candidateLinks = await extractSameOriginLinks(crawlPage, url, boundedMaxPages - 1);
    } catch (e) {
      // Crawl extraction failed, continue with single page result
    } finally {
      if (crawlBrowser) await crawlBrowser.close().catch(() => {});
    }

    for (const link of candidateLinks) {
      if (pagesResults.length >= boundedMaxPages) break;

      // Validate each crawled link against SSRF rules
      const linkVal = await validateUrl(link);
      if (!linkVal.valid) {
        failedPages.push({ url: link, error: linkVal.error });
        continue;
      }

      try {
        const subResult = await scanSinglePage(link, 20000);
        pagesResults.push(subResult);
      } catch (err) {
        failedPages.push({ url: link, error: err.message || "Failed to scan page" });
      }
    }

    // Aggregate multi-page scores and violations
    const totalScoreSum = pagesResults.reduce((acc, p) => acc + p.score, 0);
    const averageScore = Math.round(totalScoreSum / pagesResults.length);
    const combinedViolationsCount = pagesResults.reduce((acc, p) => acc + p.totalViolations, 0);

    return {
      ...initialResult,
      isMultiPage: true,
      totalPagesScanned: pagesResults.length,
      averageScore,
      combinedViolationsCount,
      pages: pagesResults,
      failedPages
    };
  } finally {
    activeScans = Math.max(0, activeScans - 1);
  }
}

module.exports = {
  scanWebsite,
  calculateAccessibilityScore,
  getActiveScansCount: () => activeScans
};
