import { useState } from "react";
import { Link } from "react-router-dom";
import { getScanHistory } from "../utils/storage";
import { generatePdfReport } from "../utils/pdfGenerator";
import { useToast } from "../context/useToast";

function Reports() {
  const { addToast } = useToast();
  const [history] = useState(() => getScanHistory());
  const [activeTab, setActiveTab] = useState("pdf"); // 'pdf' | 'compare'

  // PDF Export State
  const [selectedScanId, setSelectedScanId] = useState(() => {
    const list = getScanHistory();
    return list.length > 0 ? list[0].scanId : "";
  });

  // Comparison State
  const [scanIdA, setScanIdA] = useState(() => {
    const list = getScanHistory();
    return list.length >= 2 ? list[1].scanId : "";
  });
  const [scanIdB, setScanIdB] = useState(() => {
    const list = getScanHistory();
    return list.length >= 2 ? list[0].scanId : "";
  });

  const selectedScan = history.find((s) => s.scanId === selectedScanId);
  const scanA = history.find((s) => s.scanId === scanIdA);
  const scanB = history.find((s) => s.scanId === scanIdB);

  // Compare violations between Scan A (base) and Scan B (target)
  function getComparisonData() {
    if (!scanA || !scanB) return null;

    const violationsA = scanA.violations || [];
    const violationsB = scanB.violations || [];

    const mapA = new Map(violationsA.map((v) => [v.id, v]));
    const mapB = new Map(violationsB.map((v) => [v.id, v]));

    const resolved = [];
    const newlyDetected = [];
    const persistent = [];

    // Checked in A: if not in B -> resolved; if in B -> persistent
    for (const [id, valA] of mapA.entries()) {
      if (mapB.has(id)) {
        persistent.push({
          id,
          ruleA: valA,
          ruleB: mapB.get(id)
        });
      } else {
        resolved.push(valA);
      }
    }

    // Checked in B: if not in A -> new
    for (const [id, valB] of mapB.entries()) {
      if (!mapA.has(id)) {
        newlyDetected.push(valB);
      }
    }

    const scoreDelta = scanB.score - scanA.score;
    const violationsDelta = scanB.totalViolations - scanA.totalViolations;

    return {
      resolved,
      newlyDetected,
      persistent,
      scoreDelta,
      violationsDelta
    };
  }

  const comparison = getComparisonData();

  const getScoreColor = (score) => {
    if (score >= 80) return "score-high";
    if (score >= 50) return "score-medium";
    return "score-low";
  };

  return (
    <main className="dashboard reports-page">
      <section className="welcome-section">
        <h1>Reports &amp; Comparisons</h1>
        <p>
          Generate downloadable PDF audit reports and compare accessibility compliance
          changes over time.
        </p>
      </section>

      {/* Tabs */}
      <div className="reports-tabs-nav">
        <button
          type="button"
          className={`tab-btn ${activeTab === "pdf" ? "active" : ""}`}
          onClick={() => setActiveTab("pdf")}
        >
          📄 PDF Report Generator
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "compare" ? "active" : ""}`}
          onClick={() => setActiveTab("compare")}
        >
          ⚖ Scan Comparison
        </button>
      </div>

      {history.length === 0 ? (
        <section className="activity-card empty-history-card">
          <p>No audit scans available to generate reports or perform comparisons.</p>
          <p className="empty-sub">
            Please run at least one website audit in the Scanner first.
          </p>
          <Link to="/scanner" className="primary-action-link">
            Go to Website Scanner →
          </Link>
        </section>
      ) : activeTab === "pdf" ? (
        /* PDF Generator Tab */
        <section className="reports-tab-content">
          <div className="pdf-selector-card">
            <label htmlFor="scan-select">Select a Scan from History:</label>
            <select
              id="scan-select"
              value={selectedScanId}
              onChange={(e) => setSelectedScanId(e.target.value)}
              className="scan-dropdown"
            >
              {history.map((scan) => (
                <option key={scan.scanId} value={scan.scanId}>
                  {scan.pageTitle || scan.url} ({scan.url}) —{" "}
                  {new Date(scan.timestamp).toLocaleDateString()} [Score: {scan.score}/100]
                </option>
              ))}
            </select>
          </div>

          {selectedScan && (
            <div className="pdf-preview-card">
              <div className="pdf-preview-header">
                <div>
                  <h3>{selectedScan.pageTitle || selectedScan.url}</h3>
                  <p className="pdf-url-sub">{selectedScan.url}</p>
                  <p className="pdf-date-sub">
                    Audited: {new Date(selectedScan.timestamp).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  className="action-btn-primary download-large-btn"
                  onClick={() => {
                    generatePdfReport(selectedScan);
                    addToast("PDF audit report downloaded", "success");
                  }}
                >
                  Download PDF Report
                </button>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <p>Accessibility Score</p>
                  <h2 className={getScoreColor(selectedScan.score)}>
                    {selectedScan.score} <span className="stat-sub">/ 100</span>
                  </h2>
                </div>
                <div className="stat-card">
                  <p>Total Violations</p>
                  <h2>{selectedScan.totalViolations}</h2>
                </div>
                <div className="stat-card">
                  <p>Passed Checks</p>
                  <h2 className="text-success">{selectedScan.totalPassed}</h2>
                </div>
                <div className="stat-card">
                  <p>Affected Elements</p>
                  <h2>{selectedScan.totalAffectedElements}</h2>
                </div>
              </div>

              <div className="severity-summary-box">
                <h4>Severity Breakdown</h4>
                <div className="severity-pills-row">
                  <span className="severity-pill critical">
                    Critical: {selectedScan.severityCounts?.critical || 0}
                  </span>
                  <span className="severity-pill serious">
                    Serious: {selectedScan.severityCounts?.serious || 0}
                  </span>
                  <span className="severity-pill moderate">
                    Moderate: {selectedScan.severityCounts?.moderate || 0}
                  </span>
                  <span className="severity-pill minor">
                    Minor: {selectedScan.severityCounts?.minor || 0}
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>
      ) : (
        /* Scan Comparison Tab */
        <section className="reports-tab-content">
          {history.length < 2 ? (
            <div className="activity-card">
              <p>At least two saved scans are required to perform a comparison.</p>
              <p className="empty-sub">
                Run another scan in the Website Scanner (either the same website or a
                different page) to compare results.
              </p>
              <Link to="/scanner" className="primary-action-link">
                Run Another Scan →
              </Link>
            </div>
          ) : (
            <div className="comparison-container">
              {/* Selectors */}
              <div className="comparison-selectors-grid">
                <div className="compare-picker-box">
                  <label htmlFor="scan-a-select">Base Scan (Original / Previous):</label>
                  <select
                    id="scan-a-select"
                    value={scanIdA}
                    onChange={(e) => setScanIdA(e.target.value)}
                    className="scan-dropdown"
                  >
                    {history.map((scan) => (
                      <option key={scan.scanId} value={scan.scanId}>
                        {scan.pageTitle || scan.url} —{" "}
                        {new Date(scan.timestamp).toLocaleDateString()} [Score:{" "}
                        {scan.score}]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="compare-picker-box">
                  <label htmlFor="scan-b-select">Comparison Scan (Newer / Current):</label>
                  <select
                    id="scan-b-select"
                    value={scanIdB}
                    onChange={(e) => setScanIdB(e.target.value)}
                    className="scan-dropdown"
                  >
                    {history.map((scan) => (
                      <option key={scan.scanId} value={scan.scanId}>
                        {scan.pageTitle || scan.url} —{" "}
                        {new Date(scan.timestamp).toLocaleDateString()} [Score:{" "}
                        {scan.score}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {comparison && scanA && scanB && (
                <div className="comparison-results-card">
                  <h3>Comparison Summary</h3>

                  {/* Summary Delta Cards */}
                  <div className="comparison-metrics-grid">
                    <div className="comparison-metric-card">
                      <p>Score Difference</p>
                      <div className="metric-delta-row">
                        <span>
                          {scanA.score} → {scanB.score}
                        </span>
                        <strong
                          className={
                            comparison.scoreDelta > 0
                              ? "delta-positive"
                              : comparison.scoreDelta < 0
                              ? "delta-negative"
                              : "delta-neutral"
                          }
                        >
                          {comparison.scoreDelta > 0 ? `+${comparison.scoreDelta}` : comparison.scoreDelta}
                        </strong>
                      </div>
                    </div>

                    <div className="comparison-metric-card">
                      <p>Violations Difference</p>
                      <div className="metric-delta-row">
                        <span>
                          {scanA.totalViolations} → {scanB.totalViolations}
                        </span>
                        <strong
                          className={
                            comparison.violationsDelta < 0
                              ? "delta-positive"
                              : comparison.violationsDelta > 0
                              ? "delta-negative"
                              : "delta-neutral"
                          }
                        >
                          {comparison.violationsDelta > 0
                            ? `+${comparison.violationsDelta}`
                            : comparison.violationsDelta}
                        </strong>
                      </div>
                    </div>

                    <div className="comparison-metric-card">
                      <p>Resolved Issues</p>
                      <strong className="delta-positive">
                        {comparison.resolved.length} fixed
                      </strong>
                    </div>

                    <div className="comparison-metric-card">
                      <p>New Violations</p>
                      <strong
                        className={
                          comparison.newlyDetected.length > 0
                            ? "delta-negative"
                            : "delta-neutral"
                        }
                      >
                        {comparison.newlyDetected.length} new
                      </strong>
                    </div>
                  </div>

                  {/* Resolved Violations */}
                  <div className="comparison-category-group">
                    <h4 className="category-title resolved-title">
                      ✓ Resolved Violations ({comparison.resolved.length})
                    </h4>
                    {comparison.resolved.length === 0 ? (
                      <p className="no-items-text">
                        No violations were resolved between these two scans.
                      </p>
                    ) : (
                      <ul className="comparison-rules-list">
                        {comparison.resolved.map((r) => (
                          <li key={r.id} className="rule-item resolved">
                            <span className="rule-tag">Resolved</span>
                            <strong>{r.id}</strong> — {r.description}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Newly Detected Violations */}
                  <div className="comparison-category-group">
                    <h4 className="category-title new-title">
                      + Newly Detected Violations ({comparison.newlyDetected.length})
                    </h4>
                    {comparison.newlyDetected.length === 0 ? (
                      <p className="no-items-text">
                        No new violations detected in the comparison scan.
                      </p>
                    ) : (
                      <ul className="comparison-rules-list">
                        {comparison.newlyDetected.map((r) => (
                          <li key={r.id} className="rule-item newly-detected">
                            <span className="rule-tag">New</span>
                            <strong>{r.id}</strong> — {r.description}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Persistent Violations */}
                  <div className="comparison-category-group">
                    <h4 className="category-title persistent-title">
                      • Persistent Violations ({comparison.persistent.length})
                    </h4>
                    {comparison.persistent.length === 0 ? (
                      <p className="no-items-text">
                        No persistent violations found in common.
                      </p>
                    ) : (
                      <ul className="comparison-rules-list">
                        {comparison.persistent.map(({ id, ruleB }) => (
                          <li key={id} className="rule-item persistent">
                            <span className="rule-tag">Unchanged</span>
                            <strong>{id}</strong> — {ruleB.description} (Affects{" "}
                            {ruleB.nodeCount} elements)
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default Reports;
