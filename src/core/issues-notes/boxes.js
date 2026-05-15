// @ts-check
// Handles issue/note/warning/advisement box processing for core/issues-notes.
import { addId, showWarning } from "../utils.js";
import { createIssueSummaryEntry, makeIssueSectionSummary } from "./summary.js";
import { createLabelsGroup } from "./github-issues.js";
import { html } from "../import-maps.js";

/**
 * @typedef {import("./github-issues.js").GitHubIssue} GitHubIssue
 * @typedef {import("./summary.js").Report} Report
 *
 * @typedef {object} IssueType
 * @property {string} type
 * @property {string} displayType
 * @property {boolean} isFeatureAtRisk
 */

const name = "core/issues-notes";

/**
 * @param {HTMLElement[]} ins
 * @param {Map<string, GitHubIssue>} ghIssues
 * @param {*} conf
 * @param {object} l10n
 * @param {string} l10n.issue
 * @param {string} l10n.feature_at_risk
 * @param {string} l10n.warning
 * @param {string} l10n.editors_note
 * @param {string} l10n.note
 * @param {string} l10n.issue_summary
 * @param {string} l10n.no_issues_in_spec
 */
export function handleIssues(ins, ghIssues, conf, l10n) {
  const getIssueNumber = createIssueNumberGetter();
  const issueList = document.createElement("ul");
  ins.forEach(inno => {
    const { type, displayType, isFeatureAtRisk } = getIssueType(inno, l10n);
    const isIssue = type === "issue";
    const isInline = inno.localName === "span";
    const { number: dataNum } = inno.dataset;
    const report = {
      type,
      inline: isInline,
      title: inno.title,
      number: getIssueNumber(inno),
    };
    // wrap
    if (!isInline) {
      const cssClass = isFeatureAtRisk ? `${type} atrisk` : type;
      const ariaRole = type === "note" ? "note" : null;
      const div = html`<div class="${cssClass}" role="${ariaRole}"></div>`;
      const title = document.createElement("span");
      const className = `${type}-title marker`;
      // prettier-ignore
      const titleParent = html`<div class="${className}">${title}</div>`;
      addId(titleParent, "h", type);
      let text = displayType;
      if (inno.id) {
        div.id = inno.id;
        inno.removeAttribute("id");
      } else {
        addId(
          div,
          "issue-container",
          report.number ? `number-${report.number}` : ""
        );
      }
      /** @type {GitHubIssue | undefined} */
      let ghIssue;
      if (isIssue) {
        if (report.number !== undefined) {
          text += ` ${report.number}`;
        }
        if (inno.dataset.hasOwnProperty("number")) {
          const link = linkToIssueTracker(dataNum ?? "", conf, {
            isFeatureAtRisk,
          });
          if (link) {
            title.before(link);
            link.append(title);
          }
          title.classList.add("issue-number");
          ghIssue = ghIssues.get(dataNum ?? "");
          if (!ghIssue) {
            const msg = `Failed to fetch issue number ${dataNum}.`;
            showWarning(msg, name);
          }
          if (ghIssue && !report.title) {
            report.title = ghIssue.title;
          }
        }
        issueList.append(createIssueSummaryEntry(l10n.issue, report, div.id));
      }
      title.textContent = text;
      if (report.title) {
        inno.removeAttribute("title");
        const { repoURL = "" } = conf.github || {};
        const labels = ghIssue ? ghIssue.labels : [];
        if (ghIssue && ghIssue.state === "CLOSED") {
          div.classList.add("closed");
        }
        titleParent.append(createLabelsGroup(labels, report.title, repoURL));
      }
      /** @type {HTMLElement | DocumentFragment} */
      let body = inno;
      inno.replaceWith(div);
      body.classList.remove(type);
      body.removeAttribute("data-number");
      if (ghIssue && !body.innerHTML.trim()) {
        body = document
          .createRange()
          .createContextualFragment(ghIssue.bodyHTML);
      }
      div.append(titleParent, body);
    }
  });
  makeIssueSectionSummary(
    issueList,
    l10n.issue_summary,
    l10n.no_issues_in_spec
  );
}

/**
 * @returns {(element: HTMLElement) => number | undefined}
 */
function createIssueNumberGetter() {
  if (document.querySelector(".issue[data-number]")) {
    /**
     * @param {HTMLElement} element
     */
    return element => {
      if (element.dataset.number) {
        return Number(element.dataset.number);
      }
    };
  }

  let issueNumber = 0;
  /**
   * @param {HTMLElement} element
   */
  return element => {
    if (element.classList.contains("issue") && element.localName !== "span") {
      return ++issueNumber;
    }
  };
}

/**
 * @param {HTMLElement} inno
 * @param {object} l10n
 * @param {string} l10n.issue
 * @param {string} l10n.feature_at_risk
 * @param {string} l10n.warning
 * @param {string} l10n.editors_note
 * @param {string} l10n.note
 * @return {IssueType}
 */
function getIssueType(inno, l10n) {
  const isIssue = inno.classList.contains("issue");
  const isWarning = inno.classList.contains("warning");
  const isEdNote = inno.classList.contains("ednote");
  const isFeatureAtRisk = inno.classList.contains("atrisk");
  const type = isIssue
    ? "issue"
    : isWarning
      ? "warning"
      : isEdNote
        ? "ednote"
        : "note";
  const displayType = isIssue
    ? isFeatureAtRisk
      ? l10n.feature_at_risk
      : l10n.issue
    : isWarning
      ? l10n.warning
      : isEdNote
        ? l10n.editors_note
        : l10n.note;
  return { type, displayType, isFeatureAtRisk };
}

/**
 * @param {string} dataNum
 * @param {*} conf
 * @param {{ isFeatureAtRisk?: boolean }} [options]
 */
function linkToIssueTracker(dataNum, conf, { isFeatureAtRisk = false } = {}) {
  // Set issueBase to cause issue to be linked to the external issue tracker
  if (!isFeatureAtRisk && conf.issueBase) {
    return html`<a href="${conf.issueBase + dataNum}" />`;
  } else if (isFeatureAtRisk && conf.atRiskBase) {
    return html`<a href="${conf.atRiskBase + dataNum}" />`;
  }
}
