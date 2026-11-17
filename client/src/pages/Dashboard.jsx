import { useState } from "react";
import { Link } from "react-router-dom";
import { getScanHistory } from "../utils/storage";

function Dashboard() {
  const [history] = useState(() => getScanHistory());

  const totalScans = history.length;
  const totalIssues = history.reduce((acc, s) => acc + (s.totalViolations || 0), 0);
  const avgScore =
    totalScans > 0
      ? Math.round(history.reduce((acc, s) => acc + (s.score || 0), 0) / totalScans)
      : "--";

  const getScoreColor = (score) => {
    if (score === "--") return "";
    if (score >= 80) return "score-high";
    if (score >= 50) return "score-medium";
    return "score-low";
  };

  const recentScans = history.slice(0, 5);

  return (
    <main className="dashboard">
      <section className="welcome-section">
        <h1>Welcome back!</h1>
        <p>Monitor and improve website accessibility compliance.</p>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <p>Total Scans</p>
          <h2>{totalScans}</h2>
        </div>

        <div className="stat-card">
          <p>Issues Found</p>
          <h2>{totalScans > 0 ? totalIssues : "--"}</h2>
        </div>

        <div className="stat-card">
          <p>Average Score</p>
          <h2 className={getScoreColor(avgScore)}>
            {avgScore} {avgScore !== "--" && <span className="stat-sub">/ 100</span>}
          </h2>
        </div>
      </section>

      <section className="activity-card">
        <div className="activity-card-header">
          <h2>Recent Activity</h2>
          {totalScans > 0 && (
            <Link to="/history" className="view-all-link">
              View all ({totalScans}) →
            </Link>
          )}
        </div>

        {totalScans === 0 ? (
          <div className="dashboard-empty-state">
            <p>Your recent website scans will appear here.</p>
            <p className="empty-sub">
              No scans have been performed yet. Start auditing your web pages to view real
              accessibility reports.
            </p>
            <Link to="/scanner" className="primary-action-link">
              Go to Website Scanner →
            </Link>
          </div>
        ) : (
          <div className="recent-scans-table-wrapper">
            <table className="recent-scans-table">
              <thead>
                <tr>
                  <th>Website URL</th>
                  <th>Audit Date</th>
                  <th>Score</th>
                  <th>Violations</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentScans.map((scan) => (
                  <tr key={scan.scanId}>
                    <td className="url-cell" title={scan.url}>
                      <strong>{scan.pageTitle || scan.url}</strong>
                      <span className="sub-url-text">{scan.url}</span>
                    </td>
                    <td>{new Date(scan.timestamp).toLocaleDateString()}</td>
                    <td>
                      <span className={`score-badge-sm ${getScoreColor(scan.score)}`}>
                        {scan.score}/100
                      </span>
                    </td>
                    <td>
                      <span className="violation-count-pill">
                        {scan.totalViolations} issues
                      </span>
                    </td>
                    <td>
                      <Link
                        to="/history"
                        state={{ selectedScanId: scan.scanId }}
                        className="table-action-link"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default Dashboard;
