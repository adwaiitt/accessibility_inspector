import { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { getScanHistory, deleteScan, clearAllScans } from "../utils/storage";
import { generatePdfReport } from "../utils/pdfGenerator";
import { getViolationIssue, getViolationFix } from "../utils/remediation";
import { useToast } from "../context/useToast";
import ConfirmModal from "../components/ConfirmModal";

function History() {
  const location = useLocation();
  const { addToast } = useToast();
  const [history, setHistory] = useState(() => getScanHistory());
  const [selectedScanId, setSelectedScanId] = useState(
    () => location.state?.selectedScanId || null
  );
  const [expandedRules, setExpandedRules] = useState({});

  // UI Confirmation Modal state
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    isDanger: false,
    onConfirm: () => {}
  });

  const activeId = selectedScanId || location.state?.selectedScanId || null;
  const selectedScan = history.find((s) => s.scanId === activeId) || null;

  function promptDelete(e, scanId) {
    e.stopPropagation();
    setConfirmState({
      isOpen: true,
      title: "Delete Scan Record",
      message: "Are you sure you want to remove this scan record from your local history? This action cannot be undone.",
      confirmText: "Delete",
      isDanger: true,
      onConfirm: () => {
        const updated = deleteScan(scanId);
        setHistory(updated);
        if (activeId === scanId) {
          setSelectedScanId(null);
        }
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        addToast("Scan record removed from history", "info");
      }
    });
  }

  function promptClearAll() {
    setConfirmState({
      isOpen: true,
      title: "Clear All Scan History",
      message: "Are you sure you want to delete all saved scan history? All past audit records will be removed.",
      confirmText: "Clear All History",
      isDanger: true,
      onConfirm: () => {
        clearAllScans();
        setHistory([]);
        setSelectedScanId(null);
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        addToast("All scan records have been cleared", "info");
      }
    });
  }

  function handleDownloadPdf(scan) {
    generatePdfReport(scan);
    addToast("PDF report downloaded", "success");
  }

  function toggleRuleExpand(ruleId) {
    setExpandedRules((prev) => ({
      ...prev,
      [ruleId]: !prev[ruleId]
    }));
  }

  const getScoreColor = (score) => {
    if (score >= 80) return "score-high";
    if (score >= 50) return "score-medium";
    return "score-low";
  };

  return (
    <main className="dashboard history-page">
      <div className="section-header-flex">
        <div>
          <h1>Scan History</h1>
          <p className="section-subtext">
            Audit logs are saved locally in your browser session.
          </p>
        </div>

        {history.length > 0 && (
          <button
            type="button"
            className="clear-btn"
            onClick={promptClearAll}
          >
            Clear All History
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <section className="activity-card empty-history-card">
          <p>No previous scans found.</p>
          <p className="empty-sub">
            Run an accessibility scan to see history records, inspect issues, and export PDF
            reports.
          </p>
          <Link to="/scanner" className="primary-action-link">
            Scan a Website Now →
          </Link>
        </section>
      ) : (
        <div className="history-layout">
          {/* Scans List */}
          <section className="history-list-section">
            <div className="history-cards-container">
              {history.map((scan) => {
                const isSelected = selectedScan?.scanId === scan.scanId;
                return (
                  <div
                    key={scan.scanId}
                    className={`history-card-item ${isSelected ? "selected" : ""}`}
                    onClick={() => setSelectedScanId(scan.scanId)}
                  >
                    <div className="history-card-header">
                      <div className="history-card-title-group">
                        <h3 className="history-page-title">
                          {scan.pageTitle || scan.url}
                        </h3>
                        <span className="history-url-sub">{scan.url}</span>
                      </div>
                      <span className={`score-badge-sm ${getScoreColor(scan.score)}`}>
                        {scan.score}/100
                      </span>
                    </div>

                    <div className="history-card-meta">
                      <span>{new Date(scan.timestamp).toLocaleString()}</span>
                      <span className="meta-separator">•</span>
                      <span>{scan.totalViolations} issues detected</span>
                    </div>

                    <div className="history-card-actions">
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => setSelectedScanId(scan.scanId)}
                      >
                        {isSelected ? "Viewing" : "View Details"}
                      </button>
                      <button
                        type="button"
                        className="btn-link text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadPdf(scan);
                        }}
                      >
                        PDF
                      </button>
                      <button
                        type="button"
                        className="btn-link text-danger"
                        onClick={(e) => promptDelete(e, scan.scanId)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Detailed Inspector Drawer */}
          {selectedScan && (
            <section className="history-detail-section">
              <div className="detail-panel-header">
                <div>
                  <span className="results-badge">Historical Audit Record</span>
                  <h2>{selectedScan.pageTitle || selectedScan.url}</h2>
                  <a
                    href={selectedScan.url}
                    target="_blank"
                    rel="noreferrer"
                    className="scanned-url"
                  >
                    {selectedScan.url} ↗
                  </a>
                  <p className="timestamp-text">
                    Audited: {new Date(selectedScan.timestamp).toLocaleString()}
                  </p>
                </div>
                <div className="detail-header-actions">
                  <button
                    type="button"
                    className="action-btn-primary"
                    onClick={() => handleDownloadPdf(selectedScan)}
                  >
                    Download PDF
                  </button>
                  <button
                    type="button"
                    className="close-drawer-btn"
                    onClick={() => setSelectedScanId(null)}
                  >
                    ✕ Close
                  </button>
                </div>
              </div>

              {/* Stats overview */}
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

              {/* Violations List */}
              <div className="violations-container">
                <h3>Detected Violations ({selectedScan.violations?.length || 0})</h3>
                {selectedScan.violations?.length === 0 ? (
                  <div className="clean-audit-card">
                    <p>Zero automated accessibility violations detected in this scan.</p>
                  </div>
                ) : (
                  <div className="violation-cards-list">
                    {selectedScan.violations?.map((violation) => {
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

                          {isExpanded && (
                            <div className="violation-details-drawer">
                              <h5>Affected Elements &amp; Remediation</h5>
                              {violation.nodes?.map((node, nIdx) => (
                                <div key={nIdx} className="affected-node-box">
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
        </div>
      )}

      {/* In-app Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        isDanger={confirmState.isDanger}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />
    </main>
  );
}

export default History;
