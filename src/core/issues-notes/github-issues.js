// @ts-check
// Handles GitHub issue fetching and label rendering for core/issues-notes.
import { html } from "../import-maps.js";
import { showError } from "../utils.js";

const name = "core/issues-notes";

/**
 * @typedef {object} GitHubLabel
 * @property {string} color
 * @property {string} name
 *
 * @typedef {object} GitHubIssue
 * @property {string} title
 * @property {string} state
 * @property {string} bodyHTML
 * @property {GitHubLabel[]} labels
 */

/**
 * @returns {Promise<Map<string, GitHubIssue>>}
 * @param {{ apiBase: string, fullName: string } | null} github
 */
export async function fetchAndStoreGithubIssues(github) {
  if (!github || !github.apiBase) {
    return new Map();
  }

  /** @type {NodeListOf<HTMLElement>} */
  const specIssues = document.querySelectorAll(".issue[data-number]");
  const issueNumbers = [...specIssues]
    .map(elem => Number.parseInt(elem.dataset.number ?? "", 10))
    .filter(issueNumber => issueNumber);

  if (!issueNumbers.length) {
    return new Map();
  }

  const url = new URL("issues", `${github.apiBase}/${github.fullName}/`);
  url.searchParams.set("issues", issueNumbers.join(","));

  const response = await fetch(url.href);
  if (!response.ok) {
    const msg = `Error fetching issues from GitHub. (HTTP Status ${response.status}).`;
    showError(msg, name);
    return new Map();
  }

  /** @type {{ [issueNumber: string]: GitHubIssue }} */
  const issues = await response.json();
  return new Map(Object.entries(issues));
}

/**
 * Based on https://stackoverflow.com/a/3943023
 * See https://www.w3.org/WAI/WCAG21/Techniques/general/G18.html#tests
 * @param {string} bg background color as a hex value without '#'
 */
function textColorFromBgColor(bg) {
  const [r, g, b] = [bg.slice(0, 2), bg.slice(2, 4), bg.slice(4, 6)];
  const [R, G, B] = [r, g, b]
    .map(c => parseInt(c, 16) / 255)
    .map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  return L > 0.179 ? "#000" : "#fff";
}

/**
 * @param {GitHubLabel} label
 * @param {string} repoURL
 */
export function createLabel(label, repoURL) {
  const { color: bgColor, name } = label;
  const safeBgColor = /^[0-9a-f]{6}$/i.test(bgColor) ? bgColor : "f6f8fa";
  const issuesURL = new URL("./issues/", repoURL);
  issuesURL.searchParams.set("q", `is:issue is:open label:"${name}"`);
  const color = textColorFromBgColor(safeBgColor);
  const style = `background-color: #${safeBgColor}; color: ${color}`;
  const ariaLabel = `GitHub label: ${name}`;
  return html` <a
    class="respec-gh-label"
    style="${style}"
    href="${issuesURL.href}"
    aria-label="${ariaLabel}"
    >${name}</a
  >`;
}

/**
 * @param {GitHubLabel[]} labels
 * @param {string} title
 * @param {string} repoURL
 */
export function createLabelsGroup(labels, title, repoURL) {
  const labelsGroup = labels.map(label => createLabel(label, repoURL));
  if (labelsGroup.length) {
    labelsGroup.unshift(document.createTextNode(" "));
  }
  return html`<span class="issue-label">: ${title}${labelsGroup}</span>`;
}
