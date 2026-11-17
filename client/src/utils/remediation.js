/**
 * Remediation Helper for WCAG Accessibility Rules
 *
 * Formats axe-core violations into distinct "Issue" and "How to Fix" sections.
 */

const REMEDIATION_MAP = {
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
    fix: "Add a descriptive alt=\"...\" attribute for informative images, or alt=\"\" if the image is purely decorative."
  },
  "button-name": {
    issue: "Button does not have readable accessible text.",
    fix: "Add visible text inside the <button> element or provide an aria-label attribute describing the action."
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

export function getViolationIssue(violation) {
  if (violation.issue) return violation.issue;
  if (REMEDIATION_MAP[violation.id]) return REMEDIATION_MAP[violation.id].issue;

  let issue = violation.help || violation.description;
  if (issue.toLowerCase().startsWith("ensure that ")) {
    issue = "Requirement not met: " + issue.substring(12);
  } else if (issue.toLowerCase().startsWith("ensure ")) {
    issue = "Requirement not met: " + issue.substring(7);
  }
  return issue;
}

export function getViolationFix(violation) {
  if (violation.fix) return violation.fix;
  if (REMEDIATION_MAP[violation.id]) return REMEDIATION_MAP[violation.id].fix;
  return violation.description || violation.help || "Update DOM element markup to satisfy WCAG criteria.";
}
