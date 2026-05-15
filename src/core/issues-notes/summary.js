// @ts-check
// Handles issue summary section generation for core/issues-notes.
import { html } from "../import-maps.js";

/**
 * @typedef {object} Report
 * @property {string} type
 * @property {boolean} inline
 * @property {number | undefined} number
 * @property {string} title
 */

/**
 * @param {string} l10nIssue
 * @param {Report} report
 * @param {string} id
 */
export function createIssueSummaryEntry(l10nIssue, report, id) {
  const issueNumberText = `${l10nIssue}${
    report.number ? ` ${report.number}` : ""
  }`;
  const title = report.title
    ? html`<span style="text-transform: none">: ${report.title}</span>`
    : "";
  return html`<li><a href="${`#${id}`}">${issueNumberText}</a>${title}</li>`;
}

/**
 * @param {HTMLUListElement} issueList
 * @param {string} l10nIssue_summary
 * @param {string} l10nNo_issues_in_spec
 */
export function makeIssueSectionSummary(
  issueList,
  l10nIssue_summary,
  l10nNo_issues_in_spec
) {
  const issueSummaryElement = document.getElementById("issue-summary");
  if (!issueSummaryElement) return;
  const heading = issueSummaryElement.querySelector("h2, h3, h4, h5, h6");

  issueList.hasChildNodes()
    ? issueSummaryElement.append(issueList)
    : issueSummaryElement.append(html`<p>${l10nNo_issues_in_spec}</p>`);
  if (
    !heading ||
    (heading && heading !== issueSummaryElement.firstElementChild)
  ) {
    issueSummaryElement.prepend(html`<h1>${l10nIssue_summary}</h1>`);
  }
}
