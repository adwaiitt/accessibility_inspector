# Accessibility Inspector — Website Accessibility Auditor

**Accessibility Inspector** is an automated web application designed to evaluate the accessibility and WCAG compliance of publicly accessible websites. Built as a B.Tech Web Technology microproject, it provides real-time browser-based audits, violation remediation guidance, historical tracking, multi-scan comparisons, and downloadable PDF reports.

---

## 1. Features

- **Real Automated Audits**: Uses Playwright to launch Chromium in headless mode, render actual client-side JavaScript, and execute `axe-core` in the live DOM.
- **SSRF Protection & Safe Routing**: Strict protocol validation, DNS pre-resolution checking, CIDR IP filtering, and browser request interception to block private, internal, loopback, and cloud metadata targets.
- **Transparent Accessibility Scoring**: Evaluates violations based on weighted severity impact (Critical, Serious, Moderate, Minor) and affected node counts, clamped between 0 and 100.
- **Detailed Remediation Guidance**: Itemizes affected DOM selectors, code snippets, rule explanations, and official WCAG references.
- **Multi-Page Crawling**: Optional bounded same-origin crawler (2–10 pages) to evaluate internal navigation structures.
- **Browser-Persisted Scan History**: Stores past audit summaries in browser `localStorage` without requiring an external database.
- **Scan Comparison Tool**: Side-by-side comparative analysis of two scans to identify resolved, newly detected, and persistent violations over time.
- **Downloadable PDF Reports**: Client-side PDF generation powered by `jsPDF` for offline inspection and reporting.

---

## 2. Technology Stack

- **Frontend**:
  - React 19 (`react`, `react-dom`)
  - React Router DOM 7 (`react-router-dom`)
  - jsPDF (`jspdf`)
  - Plain responsive CSS (Developer SaaS theme)
  - Vite 8 development server and bundler
- **Backend**:
  - Node.js & Express 5
  - Playwright & Chromium
  - axe-core 4.14
  - CORS, dotenv, nodemon

---

## 3. Architecture & Folder Structure

```
accessibility_inspector/
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.jsx          # Route-aware header component
│   │   │   └── Sidebar.jsx         # Sidebar navigation links
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx       # Overview statistics & recent activity
│   │   │   ├── Scanner.jsx         # URL scanner, crawler toggle & results
│   │   │   ├── History.jsx         # Persistent audit logs & detail drawer
│   │   │   └── Reports.jsx         # PDF export & scan comparison
│   │   ├── utils/
│   │   │   ├── api.js              # Fetch client communicating with backend
│   │   │   ├── storage.js          # localStorage CRUD service
│   │   │   └── pdfGenerator.js     # jsPDF audit report generator
│   │   ├── App.css                 # Clean SaaS dashboard styling
│   │   ├── App.jsx                 # Client router layout
│   │   ├── index.css               # Global reset and typography
│   │   └── main.jsx                # React root bootstrap
│   ├── package.json
│   └── vite.config.js
│
├── server/
│   ├── controllers/
│   │   └── scanController.js       # Request validation & HTTP response handling
│   ├── routes/
│   │   └── scanRoutes.js           # API route definitions
│   ├── services/
│   │   └── scanService.js          # Playwright & axe-core orchestration
│   ├── utils/
│   │   └── urlValidator.js         # SSRF protection & DNS IP checking
│   ├── test/
│   │   └── backend.test.js         # Automated backend test suite
│   ├── .env.example                # Example environment variables
│   ├── .env                        # Local environment configuration
│   ├── package.json
│   └── server.js                   # Express application entry point
│
├── instructions.md                 # Project development requirements
├── THIRD_PARTY_NOTICES.md          # Open-source license attributions
└── README.md                       # Comprehensive project documentation
```

---

## 4. Installation & Startup Instructions

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher

### Installation

1. Clone or open the repository root:
   ```powershell
   cd accessibility_inspector
   ```

2. Install backend dependencies:
   ```powershell
   cd server
   npm install
   ```

3. Install frontend dependencies:
   ```powershell
   cd ../client
   npm install
   ```

### Running the Backend

From the `server` directory:
```powershell
npm run dev
```
The Express API runs at **`http://localhost:5000`**.

### Running the Frontend

In a separate terminal, from the `client` directory:
```powershell
npm run dev
```
The React application runs at **`http://localhost:5173`**.

---

## 5. API Documentation

### `GET /api/health`
Health check to verify API connectivity.
- **Response `200 OK`**:
  ```json
  {
    "status": "success",
    "message": "Backend API is connected successfully!"
  }
  ```

### `POST /api/scan`
Executes an automated accessibility audit.
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "url": "https://example.com",
    "multiPage": false,
    "maxPages": 3
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "scanId": "scan_1794895898084_yjsqnc",
    "url": "https://example.com",
    "pageTitle": "Example Domain",
    "timestamp": "2026-11-17T06:11:38.084Z",
    "scanDurationMs": 2092,
    "score": 82,
    "totalViolations": 3,
    "totalPassed": 10,
    "totalIncomplete": 0,
    "totalAffectedElements": 3,
    "severityCounts": {
      "critical": 0,
      "serious": 0,
      "moderate": 3,
      "minor": 0
    },
    "violations": [
      {
        "id": "landmark-one-main",
        "impact": "moderate",
        "description": "Ensure the document has a main landmark",
        "help": "Document must have one main landmark",
        "helpUrl": "https://dequeuniversity.com/rules/axe/4.14/landmark-one-main",
        "tags": ["cat.semantics", "best-practice"],
        "nodeCount": 1,
        "nodes": [
          {
            "target": ["html"],
            "html": "<html>...</html>",
            "failureSummary": "Fix all of the following: Document does not have a main landmark"
          }
        ]
      }
    ],
    "passes": [...],
    "incomplete": [...]
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Malformed URL, unsupported scheme, or DNS resolution failure.
  - `403 Forbidden`: Destination resolves to a restricted/internal IP or loopback address.
  - `408 Request Timeout`: Target website exceeded loading timeout.
  - `429 Too Many Requests`: Maximum concurrent scan capacity reached.
  - `500 Internal Server Error`: Unexpected server or browser execution failure.

---

## 6. How the Accessibility Score is Calculated

The accessibility score is calculated dynamically using a transparent, weighted deduction model starting from **100**:

$$\text{Score} = \max\left(0, \min\left(100, 100 - \sum \text{Rule Penalty}\right)\right)$$

Where each violation rule penalty is weighted by its severity impact and the number of affected elements:

| Severity Level | Base Penalty | Per-Element Penalty | Cap Per Rule |
| :--- | :--- | :--- | :--- |
| **Critical** | 10 pts | +2.0 pts | 25 pts max |
| **Serious**  | 6 pts  | +1.5 pts | 18 pts max |
| **Moderate** | 3 pts  | +1.0 pt  | 12 pts max |
| **Minor**    | 1 pt   | +0.5 pt  | 6 pts max  |

- **Caps**: Caps per rule prevent a single recurring minor issue (e.g. repeated link formatting) from completely destroying the score.
- **Clean Audit**: Pages with 0 detected violations receive a score of **100**. Note that this denotes zero *automated* violations detected, not complete manual WCAG certification.

---

## 7. Security & SSRF Safeguards

Because user-supplied URLs can point to malicious or internal targets, the backend employs multi-layered defense-in-depth:
1. **Scheme Restriction**: Only `http:` and `https:` schemes are permitted.
2. **Credential Blocking**: Embedded credentials (e.g., `user:pass@host`) are rejected.
3. **Internal Hostname Matching**: Blocks `localhost`, `*.local`, `*.internal`, `*.lan`, `metadata.google.internal`, etc.
4. **Pre-Flight DNS Resolution & IP CIDR Filtering**: Every domain is resolved via `dns.promises.lookup()`. All resolved IPv4 and IPv6 addresses are evaluated against reserved/private CIDR ranges:
   - Loopback (`127.0.0.0/8`, `::1`)
   - Private networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `fc00::/7`)
   - Cloud metadata (`169.254.169.254`, `169.254.0.0/16`, `fe80::/10`)
   - Carrier-grade NAT (`100.64.0.0/10`)
   - Multicast, broadcast, documentation, and reserved ranges
5. **Browser Request Interception**: Playwright's `page.route('**')` intercepts every outgoing subresource and redirect request, validating URLs before network dispatch.
6. **Payload Sanitization**: Snippets extracted from the remote DOM are truncated and rendered as escaped plain text inside React components to eliminate Cross-Site Scripting (XSS).
7. **Resource Bounds**: Strict timeouts (30s) and concurrency caps (2 simultaneous browser instances) protect the server from memory exhaustion. All browser pages, contexts, and instances are cleaned up in `finally` blocks.

---

## 8. Automated Testing

The backend includes a dedicated automated test suite covering all security, validation, and scanning operations:

```powershell
cd server
npm test
```

Tests verify:
- Backend health check
- Rejection of empty/missing URLs (400)
- Rejection of unsupported protocols (400)
- Blocking of `localhost` (403)
- Blocking of private IPv4 ranges (403)
- Blocking of cloud metadata endpoints (403)
- Blocking of loopback IP `127.0.0.1` (403)
- Handling of unresolvable domains (400)
- End-to-end audit of public websites with Playwright & axe-core (200)
- Bounded multi-page crawl functionality

---

## 9. Known Limitations

- **Automated vs. Manual Testing**: Automated audits with axe-core typically detect ~30%–50% of all WCAG issues (contrast, alt text presence, ARIA structure, form labels). Full compliance requires supplementary manual testing (screen readers, keyboard-only navigation, cognitive evaluations).
- **CAPTCHAs & Bot Gates**: Websites employing Cloudflare Turnstile, reCAPTCHA, or strict bot-mitigation headers may block headless Chromium requests. The scanner returns an informative error rather than attempting evasion.
- **Authentication Walls**: Pages behind login screens or SSO sessions cannot be audited without user credentials, which are strictly outside the scope of this auditor.
