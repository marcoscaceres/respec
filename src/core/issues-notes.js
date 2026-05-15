// @ts-check
// Module core/issues-notes
// Manages issues and notes, including marking them up, numbering, inserting the title,
// and injecting the style sheet.
// These are elements with classes "issue" or "note".
// When an issue or note is found, it is reported using the "issue" or "note" event. This can
// be used by a containing shell to extract all of these.
// Issues are automatically numbered by default, but you can assign them specific numbers (or,
// despite the name, any arbitrary identifier) using the data-number attribute. Note that as
// soon as you use one data-number on any issue all the other issues stop being automatically
// numbered to avoid involuntary clashes.
// If the configuration has issueBase set to a non-empty string, and issues are
// manually numbered, a link to the issue is created using issueBase and the issue number
import css from "../styles/issues-notes.css.js";
import { fetchAndStoreGithubIssues } from "./issues-notes/github-issues.js";
import { getIntlData } from "./utils.js";
import { handleIssues } from "./issues-notes/boxes.js";
import { html } from "./import-maps.js";
export const name = "core/issues-notes";

const localizationStrings = {
  en: {
    editors_note: "Editor's note",
    feature_at_risk: "(Feature at Risk) Issue",
    issue: "Issue",
    issue_summary: "Issue summary",
    no_issues_in_spec: "There are no issues listed in this specification.",
    note: "Note",
    warning: "Warning",
  },
  ja: {
    note: "注",
    editors_note: "編者注",
    feature_at_risk: "(変更の可能性のある機能) Issue",
    issue: "Issue",
    issue_summary: "Issue の要約",
    no_issues_in_spec: "この仕様には未解決の issues は含まれていません．",
    warning: "警告",
  },
  nl: {
    editors_note: "Redactionele noot",
    issue_summary: "Lijst met issues",
    no_issues_in_spec: "Er zijn geen problemen vermeld in deze specificatie.",
    note: "Noot",
    warning: "Waarschuwing",
  },
  es: {
    editors_note: "Nota de editor",
    issue: "Cuestión",
    issue_summary: "Resumen de la cuestión",
    note: "Nota",
    no_issues_in_spec: "No hay problemas enumerados en esta especificación.",
    warning: "Aviso",
  },
  de: {
    editors_note: "Redaktioneller Hinweis",
    issue: "Frage",
    issue_summary: "Offene Fragen",
    no_issues_in_spec: "Diese Spezifikation enthält keine offenen Fragen.",
    note: "Hinweis",
    warning: "Warnung",
  },
  zh: {
    editors_note: "编者注",
    feature_at_risk: "（有可能变动的特性）Issue",
    issue: "Issue",
    issue_summary: "Issue 总结",
    no_issues_in_spec: "本规范中未列出任何 issue。",
    note: "注",
    warning: "警告",
  },
  cs: {
    editors_note: "Poznámka editora",
    feature_at_risk: "(Funkce v ohrožení) Problém",
    issue: "Problém",
    issue_summary: "Souhrn problémů",
    no_issues_in_spec: "V této specifikaci nejsou uvedeny žádné problémy.",
    note: "Poznámka",
    warning: "Varování",
  },
  fr: {
    editors_note: "Note de l'éditeur",
    issue: "Problème",
    issue_summary: "Résumé des problèmes",
    no_issues_in_spec:
      "Il n'y a aucun problème répertorié dans cette spécification.",
    note: "Note",
    warning: "Avertissement",
  },
};

const l10n = getIntlData(localizationStrings);

/**
 * @param {Conf} conf
 */
export async function run(conf) {
  const query = ".issue, .note, .warning, .ednote";
  /** @type {NodeListOf<HTMLElement>} */
  const allEls = document.querySelectorAll(query);

  const issuesAndNotes = Array.from(allEls).filter(itm => {
    // Removes any elements that are not HTML Elements (e.g., SVG nodes)
    return itm instanceof HTMLElement;
  });

  if (!issuesAndNotes.length) {
    return; // nothing to do.
  }
  const ghIssues = await fetchAndStoreGithubIssues(
    /** @type {{ apiBase: string, fullName: string } | null} */ (
      conf.github ?? null
    )
  );
  const { head: headElem } = document;
  headElem.insertBefore(
    html`<style>
      ${css}
    </style>`,
    headElem.querySelector("link")
  );
  handleIssues(issuesAndNotes, ghIssues, conf, l10n);
  const ednotes = document.querySelectorAll(".ednote");
  ednotes.forEach(ednote => {
    ednote.classList.remove("ednote");
    ednote.classList.add("note");
  });
}
