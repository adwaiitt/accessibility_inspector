import { useState } from "react";
import { runScan } from "../utils/api";
import { saveScan } from "../utils/storage";
import { generatePdfReport } from "../utils/pdfGenerator";
import { getViolationIssue, getViolationFix } from "../utils/remediation";
import { useToast } from "../context/useToast";

function Scanner() {
  const { addToast } = useToast();
  const [url, setUrl] = useState("");
  const [multiPage, setMultiPage] = useState(false);
  const [maxPages, setMaxPages] = useState(3);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentScan, setCurrentScan] = useState(null);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [expandedRules, setExpandedRules] = useState({});

  function toggleRuleExpand(ruleId) {
    setExpandedRules((prev) => ({
      ...prev,
      [ruleId]: !prev[ruleId]
    }));
  }

  async function handleScan(e) {
    if (e) e.preventDefault();
    setError("");

    if (!url.trim()) {
      setError("Please enter a website URL.");
      return;
    }

    try {
      const parsedUrl = new URL(url.trim());
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        setError("Only HTTP and HTTPS URLs are supported.");
        return;
      }
    } catch {
      setError("Please enter a valid URL, including http:// or https://");
      return;
    }

    setLoading(true);
    setCurrentScan(null);

    try {
      const result = await runScan({
        url: url.trim(),
        multiPage,
        maxPages: Number(maxPages) || 3
      });

      setCurrentScan(result);
      // Persist to localStorage
      saveScan(result);
      addToast(`Scan completed successfully! Score: ${result.score}/100`, "success");
    } catch (err) {
      setError(err.message || "Failed to scan website. Please try again.");
      addToast(err.message || "Scan failed. Please verify the URL and try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  // Filter violations
  const violations = currentScan?.violations || [];
  const filteredViolations = violations.filter((v) => {
    if (severityFilter === "all") return true;
    return (v.impact || "").toLowerCase() === severityFilter;
  });

  const getScoreColor = (score) => {
    if (score >= 80) return "score-high";
    if (score >= 50) return "score-medium";
    return "score-low";
  };

  return (
    <main className="dashboard scanner-page">
      <section className="welcome-section">
        <h1>Website Accessibility Scanner</h1>
        <p>
          Analyze a website using Playwright and axe-core to discover accessibility
          violations and WCAG compliance issues.
        </p>
      </section>

      {/* Input Card */}
      <section className="scanner-card">
        <form onSubmit={handleScan}>
          <label htmlFor="website-url">Website URL</label>
          <div className="input-row">
            <input
              id="website-url"
              type="text"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="scanner-options">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={multiPage}
                onChange={(e) => setMultiPage(e.target.checked)}
                disabled={loading}
              />
              <span>Multi-page crawl (internal same-origin links)</span>
            </label>

            {multiPage && (
              <div className="max-pages-selector">
                <label htmlFor="max-pages">Pages limit:</label>
                <select
                  id="max-pages"
                  value={maxPages}
                  onChange={(e) => setMaxPages(Number(e.target.value))}
                  disabled={loading}
                >
                  <option value={2}>2 pages</option>
                  <option value={3}>3 pages</option>
                  <option value={5}>5 pages</option>
                  <option value={10}>10 pages (max)</option>
                </select>
              </div>
            )}
          </div>

          {error && <p className="error-message">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="scan-button"
          >
            {loading ? "Scanning with Playwright & axe-core..." : "Start Accessibility Scan"}
          </button>

          <p className="scanner-note">
            Automated scan against WCAG 2.0, 2.1 Level A &amp; AA and best practices.
            Internal/private addresses and non-HTTP protocols are blocked for security.
          </p>
        </form>
      </section>

      {/* Loading State Indicator */}
      {loading && (
        <section className="scan-loading-card">
          <div className="spinner"></div>
          <p>
            Launching Chromium, navigating to <strong>{url}</strong> and running
            accessibility rules... This typically takes 5–15 seconds.
          </p>
        </section>
      )}

      {/* Real Scan Results */}
      {currentScan && !loading && (
        <section className="results-container">
          <div className="results-header-card">
            <div className="results-title-group">
              <span className="results-badge">Scan Complete</span>
              <h2>{currentScan.pageTitle || currentScan.url}</h2>
              <a
                href={currentScan.url}
                target="_blank"
                rel="noreferrer"
                className="scanned-url"
              >
                {currentScan.url} ↗
              </a>
              <p className="timestamp-text">
                Scanned on {new Date(currentScan.timestamp).toLocaleString()} • Duration:{" "}
                {(currentScan.scanDurationMs / 1000).toFixed(2)}s
              </p>
            </div>

            <div className="results-actions">
              <button
                type="button"
                className="action-btn-primary"
                onClick={() => {
                  generatePdfReport(currentScan);
                  addToast("PDF audit report downloaded", "success");
                }}
              >
                Download PDF Report
              </button>
            </div>
          </div>

          {/* Score & Key Metric Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <p>Accessibility Score</p>
              <h2 className={getScoreColor(currentScan.score)}>
                {currentScan.score} <span className="stat-sub">/ 100</span>
              </h2>
            </div>

            <div className="stat-card">
              <p>Total Violations</p>
              <h2>{currentScan.totalViolations}</h2>
            </div>

            <div className="stat-card">
              <p>Passed Checks</p>
              <h2 className="text-success">{currentScan.totalPassed}</h2>
            </div>

            <div className="stat-card">
              <p>Affected Elements</p>
              <h2>{currentScan.totalAffectedElements}</h2>
            </div>
          </div>

          {/* Multi-page Summary if Applicable */}
          {currentScan.isMultiPage && currentScan.pages && (
            <div className="multi-page-summary-card">
              <h3>Crawled Pages Summary ({currentScan.totalPagesScanned} pages)</h3>
              <p className="summary-desc">
                Average Crawl Score: <strong>{currentScan.averageScore} / 100</strong> across{" "}
                {currentScan.totalPagesScanned} internal pages.
              </p>
              <ul className="crawled-pages-list">
                {currentScan.pages.map((p, idx) => (
                  <li key={idx} className="crawled-page-item">
                    <span className="page-url">{p.url}</span>
                    <span className={`page-score-pill ${getScoreColor(p.score)}`}>
                      Score: {p.score}
                    </span>
                    <span className="page-violations-pill">
                      {p.totalViolations} issues
                    </span>
                  </li>
                ))}
              </ul>
              {currentScan.failedPages?.length > 0 && (
                <div className="failed-pages-list">
                  <p className="text-warning">Inaccessible / Unscanned pages:</p>
                  {currentScan.failedPages.map((fp, idx) => (
                    <small key={idx}>
                      • {fp.url}: {fp.error}
                    </small>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Violations Section */}
          <div className="violations-container">
            <div className="violations-header">
              <div>
                <h3>Violations ({filteredViolations.length})</h3>
                <p className="violations-sub">
                  Issues detected by axe-core rules requiring remediation.
                </p>
              </div>

              {/* Severity Filter Tabs */}
              <div className="filter-button-group">
                <button
                  type="button"
                  className={`filter-btn ${severityFilter === "all" ? "active" : ""}`}
                  onClick={() => setSeverityFilter("all")}
                >
                  All ({violations.length})
                </button>
                <button
                  type="button"
                  className={`filter-btn ${severityFilter === "critical" ? "active" : ""}`}
                  onClick={() => setSeverityFilter("critical")}
                >
                  Critical ({currentScan.severityCounts?.critical || 0})
                </button>
                <button
                  type="button"
                  className={`filter-btn ${severityFilter === "serious" ? "active" : ""}`}
                  onClick={() => setSeverityFilter("serious")}
                >
                  Serious ({currentScan.severityCounts?.serious || 0})
                </button>
                <button
                  type="button"
                  className={`filter-btn ${severityFilter === "moderate" ? "active" : ""}`}
                  onClick={() => setSeverityFilter("moderate")}
                >
                  Moderate ({currentScan.severityCounts?.moderate || 0})
                </button>
                <button
                  type="button"
                  className={`filter-btn ${severityFilter === "minor" ? "active" : ""}`}
                  onClick={() => setSeverityFilter("minor")}
                >
                  Minor ({currentScan.severityCounts?.minor || 0})
                </button>
              </div>
            </div>

            {filteredViolations.length === 0 ? (
              <div className="clean-audit-card">
                <p>
                  No violations found matching the selected filter.
                  {violations.length === 0 &&
                    " Zero automated accessibility violations were detected on this page."}
                </p>
              </div>
            ) : (
              <div className="violation-cards-list">
                {filteredViolations.map((violation) => {
                  const isExpanded = !!expandedRules[violation.id];
                  const impactClass = `impact-${(violation.impact || "minor").toLowerCase()}`;

                  return (
                    <div key={violation.id} className="violation-card">
                      <div
                        className="violation-card-header"
                        onClick={() => toggleRuleExpand(violation.id)}
                      >
                        <div className="violation-title-area">
                          <span className={`severity-badge ${impactClass}`}>
                            {violation.impact || "minor"}
                          </span>
                          <h4 className="violation-id">{violation.id}</h4>
                          <span className="violation-node-count">
                            {violation.nodeCount} element{violation.nodeCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="expand-toggle-btn"
                          aria-label={isExpanded ? "Collapse violation" : "Expand violation"}
                        >
                          {isExpanded ? "▲ Hide" : "▼ Details"}
                        </button>
                      </div>

                      {/* Structured Issue and Fix Output */}
                      <div className="violation-remediation-body">
                        <div className="remediation-block issue-block">
                          <span className="block-tag issue-tag">ISSUE</span>
                          <p className="block-content">{getViolationIssue(violation)}</p>
                        </div>

                        <div className="remediation-block fix-block">
                          <span className="block-tag fix-tag">HOW TO FIX</span>
                          <p className="block-content">{getViolationFix(violation)}</p>
                        </div>
                      </div>

                      <div className="violation-meta-tags">
                        {violation.tags?.slice(0, 5).map((t) => (
                          <span key={t} className="tag-pill">
                            {t}
                          </span>
                        ))}
                        {violation.helpUrl && (
                          <a
                            href={violation.helpUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="help-link"
                          >
                            Rule Docs ↗
                          </a>
                        )}
                      </div>

                      {/* Expandable Affected Nodes & Suggestions */}
                      {isExpanded && (
                        <div className="violation-details-drawer">
                          <h5>Affected Elements &amp; Remediation</h5>
                          {violation.nodes?.map((node, nodeIdx) => (
                            <div key={nodeIdx} className="affected-node-box">
                              {node.target && (
                                <p className="node-selector">
                                  <strong>Selector:</strong>{" "}
                                  <code>{node.target.join(" ")}</code>
                                </p>
                              )}
                              {node.html && (
                                <div className="node-snippet">
                                  <span className="snippet-label">HTML:</span>
                                  <pre>
                                    <code>{node.html}</code>
                                  </pre>
                                </div>
                              )}
                              {node.failureSummary && (
                                <div className="node-fix-summary">
                                  <span className="fix-label">Suggested Fix:</span>
                                  <p>{node.failureSummary}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

export default Scanner;
