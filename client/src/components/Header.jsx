import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { checkApiHealth } from "../utils/api";

function Header() {
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(null); // null = checking, true = online, false = offline

  let title = "Dashboard";
  let subtitle = "Website Accessibility Overview";

  if (location.pathname === "/scanner") {
    title = "Website Scanner";
    subtitle = "Analyze web pages to detect WCAG accessibility issues";
  } else if (location.pathname === "/history") {
    title = "Scan History";
    subtitle = "View and review previous accessibility audit results";
  } else if (location.pathname === "/reports") {
    title = "Reports & Comparison";
    subtitle = "Generate downloadable PDF audit reports and compare scans";
  }

  useEffect(() => {
    document.title = `${title} — Accessibility Inspector`;
  }, [title]);

  const verifyBackend = useCallback(() => {
    checkApiHealth()
      .then(() => setIsOnline(true))
      .catch(() => setIsOnline(false));
  }, []);

  useEffect(() => {
    let active = true;

    function ping() {
      checkApiHealth()
        .then(() => {
          if (active) setIsOnline(true);
        })
        .catch(() => {
          if (active) setIsOnline(false);
        });
    }

    ping();
    const interval = setInterval(ping, 10000); // Poll every 10 seconds

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="top-header">
      <div className="header-content">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

      <div
        className={`header-status-pill ${
          isOnline === true
            ? "status-online"
            : isOnline === false
            ? "status-offline"
            : "status-checking"
        }`}
        onClick={verifyBackend}
        title={
          isOnline === false
            ? "Cannot connect to backend server on http://localhost:5000. Click to retry."
            : "Backend connected on http://localhost:5000. Click to refresh status."
        }
        role="button"
        tabIndex={0}
      >
        <span className="live-dot"></span>
        <span>
          {isOnline === true
            ? "Backend Online"
            : isOnline === false
            ? "Backend Offline"
            : "Checking..."}
        </span>
      </div>
    </header>
  );
}

export default Header;
