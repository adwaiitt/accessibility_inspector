/**
 * URL Validator & SSRF Protection Utility
 *
 * Implements strict validation and DNS resolution checks to prevent
 * Server-Side Request Forgery (SSRF) against internal, private, loopback,
 * link-local, and cloud metadata addresses.
 */

const dns = require("dns").promises;
const net = require("net");

// Helper: Convert IPv4 string to 32-bit unsigned number
function ipv4ToNumber(ip) {
  return ip.split(".").reduce((acc, octet) => ((acc << 8) + parseInt(octet, 10)) >>> 0, 0);
}

// CIDR match for IPv4
function matchIpv4Cidr(ipNum, cidrBase, cidrMask) {
  const baseNum = ipv4ToNumber(cidrBase);
  const mask = cidrMask === 0 ? 0 : (~0 << (32 - cidrMask)) >>> 0;
  return (ipNum & mask) === (baseNum & mask);
}

// Reserved/Private IPv4 CIDR blocks
const IPV4_BLOCKED_RANGES = [
  { base: "0.0.0.0", mask: 8, reason: "Current network" },
  { base: "10.0.0.0", mask: 8, reason: "Private network (Class A)" },
  { base: "100.64.0.0", mask: 10, reason: "Carrier-grade NAT" },
  { base: "127.0.0.0", mask: 8, reason: "Loopback" },
  { base: "169.254.0.0", mask: 16, reason: "Link-local / Cloud metadata" },
  { base: "172.16.0.0", mask: 12, reason: "Private network (Class B)" },
  { base: "192.0.0.0", mask: 24, reason: "IETF protocol assignments" },
  { base: "192.0.2.0", mask: 24, reason: "TEST-NET-1" },
  { base: "192.88.99.0", mask: 24, reason: "6to4 relay anycast" },
  { base: "192.168.0.0", mask: 16, reason: "Private network (Class C)" },
  { base: "198.18.0.0", mask: 15, reason: "Network benchmarking" },
  { base: "198.51.100.0", mask: 24, reason: "TEST-NET-2" },
  { base: "203.0.113.0", mask: 24, reason: "TEST-NET-3" },
  { base: "224.0.0.0", mask: 4, reason: "Multicast" },
  { base: "240.0.0.0", mask: 4, reason: "Reserved / Future use" },
  { base: "255.255.255.255", mask: 32, reason: "Broadcast" }
];

// Blocked hostnames (exact or suffix match)
const BLOCKED_HOSTNAMES = [
  "localhost",
  "metadata.google.internal",
  "instance-data",
  "metadata.aws.internal"
];

const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".home",
  ".corp"
];

/**
 * Checks if an IPv4 address is in a private, loopback, or reserved range.
 */
function isBlockedIpv4(ip) {
  const ipNum = ipv4ToNumber(ip);
  for (const range of IPV4_BLOCKED_RANGES) {
    if (matchIpv4Cidr(ipNum, range.base, range.mask)) {
      return { blocked: true, reason: range.reason };
    }
  }
  return { blocked: false };
}

/**
 * Checks if an IPv6 address is in a private, loopback, or reserved range.
 */
function isBlockedIpv6(ip) {
  const normalized = ip.toLowerCase();

  // Loopback and unspecified
  if (normalized === "::1" || normalized === "::" || normalized === "0:0:0:0:0:0:0:1" || normalized === "0:0:0:0:0:0:0:0") {
    return { blocked: true, reason: "IPv6 loopback/unspecified" };
  }

  // IPv4-mapped IPv6: e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1
  const ipv4MappedMatch = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (ipv4MappedMatch) {
    return isBlockedIpv4(ipv4MappedMatch[1]);
  }

  // Unique local addresses (fc00::/7 -> starts with fc or fd)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return { blocked: true, reason: "IPv6 unique local address" };
  }

  // Link-local (fe80::/10 -> starts with fe8, fe9, fea, feb)
  if (/^fe[89ab]/i.test(normalized)) {
    return { blocked: true, reason: "IPv6 link-local address" };
  }

  // Multicast (ff00::/8)
  if (normalized.startsWith("ff")) {
    return { blocked: true, reason: "IPv6 multicast address" };
  }

  // Discard-only prefix (100::/64)
  if (normalized.startsWith("100:")) {
    return { blocked: true, reason: "IPv6 discard prefix" };
  }

  // Documentation prefix (2001:db8::/32)
  if (normalized.startsWith("2001:db8:") || normalized === "2001:db8") {
    return { blocked: true, reason: "IPv6 documentation prefix" };
  }

  return { blocked: false };
}

/**
 * Determines whether an IP address is blocked.
 */
function isBlockedIp(ip) {
  const version = net.isIP(ip);
  if (version === 4) {
    return isBlockedIpv4(ip);
  }
  if (version === 6) {
    return isBlockedIpv6(ip);
  }
  return { blocked: false };
}

/**
 * Validates a user-supplied URL against syntax and SSRF rules.
 * Performs DNS resolution to verify the destination resolves to a public address.
 *
 * @param {string} inputUrl - The URL to validate
 * @returns {Promise<{ valid: boolean, error?: string, parsedUrl?: URL, resolvedIps?: string[] }>}
 */
async function validateUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== "string") {
    return { valid: false, error: "Website URL is required." };
  }

  const trimmed = inputUrl.trim();
  if (!trimmed) {
    return { valid: false, error: "Website URL cannot be empty." };
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return {
      valid: false,
      error: "Invalid URL format. Please include http:// or https://"
    };
  }

  // Only allow HTTP and HTTPS
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return {
      valid: false,
      error: `Unsupported protocol "${parsedUrl.protocol}". Only HTTP and HTTPS are allowed.`
    };
  }

  // Disallow credentials in URL
  if (parsedUrl.username || parsedUrl.password) {
    return {
      valid: false,
      error: "URLs with embedded credentials (username/password) are not allowed."
    };
  }

  const hostname = parsedUrl.hostname.toLowerCase().trim();
  if (!hostname) {
    return { valid: false, error: "URL does not contain a valid hostname." };
  }

  // Check known internal hostnames
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return {
      valid: false,
      error: `Access to "${hostname}" is restricted for security.`
    };
  }

  for (const suffix of BLOCKED_HOST_SUFFIXES) {
    if (hostname.endsWith(suffix)) {
      return {
        valid: false,
        error: `Access to internal domain suffix "${suffix}" is restricted.`
      };
    }
  }

  // If the hostname itself is an IP address, check directly
  const directIpVersion = net.isIP(hostname);
  if (directIpVersion > 0) {
    const check = isBlockedIp(hostname);
    if (check.blocked) {
      return {
        valid: false,
        error: `Access to IP ${hostname} is blocked (${check.reason}).`
      };
    }
    return { valid: true, parsedUrl, resolvedIps: [hostname] };
  }

  // Resolve DNS to verify all resolved IP addresses are public
  try {
    const records = await dns.lookup(hostname, { all: true });
    if (!records || records.length === 0) {
      return {
        valid: false,
        error: `Could not resolve hostname "${hostname}".`
      };
    }

    const resolvedIps = records.map((r) => r.address);

    for (const record of records) {
      const check = isBlockedIp(record.address);
      if (check.blocked) {
        return {
          valid: false,
          error: `Destination "${hostname}" resolves to a restricted internal address (${record.address}: ${check.reason}).`
        };
      }
    }

    return { valid: true, parsedUrl, resolvedIps };
  } catch (err) {
    return {
      valid: false,
      error: `DNS resolution failed for "${hostname}": ${err.code || err.message}`
    };
  }
}

module.exports = {
  validateUrl,
  isBlockedIp
};
