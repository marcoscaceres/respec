// @ts-check
/**
 * Linter rule "no-rfc2119-in-informative".
 *
 * Warns when RFC 2119 keywords (MUST, SHALL, SHOULD, etc.) appear in
 * non-normative sections. By the time this linter runs, core/inlines.js
 * has already wrapped those keywords in `<em class="rfc2119">`, so we
 * query for those elements and test each one's context.
 *
 * A section is considered informative when the element's closest ancestor
 * matching the nonNormativeSelector is NOT itself contained within a
 * `.normative` block (the same logic used by core/xref.js's isNormative).
 *
 * This rule is opt-in: set `lint: { "no-rfc2119-in-informative": true }`.
 */
import {
  docLink,
  getIntlData,
  nonNormativeSelector,
  showWarning,
} from "../utils.js";

const ruleName = "no-rfc2119-in-informative";
export const name = `core/linter-rules/${ruleName}`;

/** @satisfies {Record<string, { readonly msg: string; readonly hint: string }>} */
const localizationStrings = {
  en: {
    msg: "RFC 2119 keywords found in informative section.",
    get hint() {
      return docLink`RFC 2119 keywords (MUST, SHALL, SHOULD, MAY, etc.) are normative
        and MUST NOT appear in informative (non-normative) sections. Either move the
        content to a normative section or rephrase without normative language.

        To silence this warning entirely, set \`lint: { "${ruleName}": false }\` in
        your \`respecConfig\`. To suppress it for a specific element, add
        \`class="lint-ignore"\` to the containing element.

        See ${"[lint|#lint]"}.`;
    },
  },
};
const l10n = getIntlData(localizationStrings);

/**
 * Returns true when the element is inside a non-normative context,
 * using the same logic as core/xref.js's isNormative() function.
 * @param {Element} elem
 */
function isInInformativeContext(elem) {
  const closestNormative = elem.closest(".normative");
  const closestInform = elem.closest(nonNormativeSelector);
  if (!closestInform) {
    return false;
  }
  if (!closestNormative) {
    return true;
  }
  // There is both a normative and an informative ancestor. The element is
  // informative only when the normative ancestor is *not* inside the informative
  // ancestor (i.e. the informative ancestor is the closer one).
  return !closestInform.contains(closestNormative);
}

/**
 * @param {Conf} conf
 */
export function run(conf) {
  // @ts-expect-error -- LintConfig can be false; ?. only short-circuits null/undefined in TS
  if (!conf.lint?.[ruleName]) return;

  /** @type {NodeListOf<HTMLElement>} */
  const candidates = document.querySelectorAll("em.rfc2119");

  const offenders = [...candidates].filter(
    em => isInInformativeContext(em) && !em.closest(".lint-ignore")
  );

  if (!offenders.length) return;

  showWarning(l10n.msg, name, {
    hint: l10n.hint,
    elements: offenders,
  });
}
