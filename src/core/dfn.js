// @ts-check
// Module core/dfn
// - Finds all <dfn> elements and populates definitionMap to identify them.

import {
  codedJoinOr,
  docLink,
  getDfnTitles,
  norm,
  showError,
  toMDCode,
} from "./utils.js";
import {
  validateCommonName,
  validateDOMName,
  validateMimeType,
  validateQuotedString,
} from "./dfn-validators.js";
import { registerDefinition } from "./dfn-map.js";
import { slotRegex } from "./inline-idl-parser.js";

export const name = "core/dfn";

/**
 * Matches a fully qualified method signature in dfn text content, e.g.:
 *   watchPosition(successCallback, errorCallback)
 *   watchPosition()
 *
 * Group 1: method name (identifier)
 * Group 2: argument list content (may be empty)
 */
const qualifiedMethodRegex = /^([A-Za-z_$][A-Za-z0-9_$]*)\(([^)]*)\)$/;

/** @type {Map<string, { requiresFor: boolean, validator?: DefinitionValidator, associateWith?: string}>}  */
const knownTypesMap = new Map([
  ["abstract-op", { requiresFor: false }],
  [
    "attr-value",
    {
      requiresFor: true,
      associateWith: "a markup attribute",
      validator: validateCommonName,
    },
  ],
  ["element", { requiresFor: false, validator: validateDOMName }],
  [
    "element-attr",
    {
      requiresFor: false,
      validator: validateDOMName,
    },
  ],
  [
    "element-state",
    {
      requiresFor: true,
      associateWith: "a markup attribute",
      validator: validateCommonName,
    },
  ],
  ["event", { requiresFor: false, validator: validateCommonName }],
  ["http-header", { requiresFor: false }],
  ["media-type", { requiresFor: false, validator: validateMimeType }],
  ["scheme", { requiresFor: false, validator: validateCommonName }],
  ["permission", { requiresFor: false, validator: validateQuotedString }],
]);

const knownTypes = [...knownTypesMap.keys()];

export function run() {
  for (const dfn of document.querySelectorAll("dfn")) {
    processQualifiedMethodDfn(dfn);
    const titles = getDfnTitles(dfn);
    registerDefinition(dfn, titles);

    // It's a legacy cite or redefining a something it doesn't own, so it gets no benefit.
    if (dfn.dataset.cite && /\b#\b/.test(dfn.dataset.cite)) {
      continue;
    }

    const [linkingText] = titles;
    computeType(dfn, linkingText);
    computeExport(dfn);

    // Only add `lt`s that are different from the text content and local-lts
    const localLt = (dfn.dataset.localLt || "").split("|").map(norm);
    const lt = titles.filter(t => !localLt.includes(t));
    if (lt.length > 1 || linkingText !== norm(dfn.textContent)) {
      dfn.dataset.lt = lt.join("|");
    }
  }
}

/**
 * @param {HTMLElement} dfn
 * @param {string} linkingText
 * */
function computeType(dfn, linkingText) {
  let type = "";

  switch (true) {
    // class defined type (e.g., "<dfn class="element">)
    case knownTypes.some(name => dfn.classList.contains(name)):
      // First one wins
      type =
        [...dfn.classList].find(className => knownTypesMap.has(className)) ??
        "";
      validateDefinition(linkingText, type, dfn);
      break;

    // Internal slots: attributes+ methods (e.g., [[some words]](with, optional, arguments))
    case slotRegex.test(linkingText):
      type = processAsInternalSlot(linkingText, dfn);
      break;
  }

  // Derive closest type
  if (!type && !dfn.matches("[data-dfn-type]")) {
    /** @type {HTMLElement | null} */
    const closestType = dfn.closest("[data-dfn-type]");
    type = closestType?.dataset.dfnType ?? "";
  }
  // only if we have type and one wasn't explicitly given.
  if (type && !dfn.dataset.dfnType) {
    dfn.dataset.dfnType = type;
  }
  // Finally, addContractDefaults() will add the type to the dfn if it's not there.
  // But other modules may end up adding a type (e.g., the WebIDL module)
}

// Deal with export/no export
/**
 * @param {HTMLElement} dfn
 */
function computeExport(dfn) {
  switch (true) {
    // Error if we have both exports and no exports.
    case dfn.matches(".export.no-export"): {
      const msg = docLink`Declares both "${"[no-export]"}" and "${"[export]"}" CSS class.`;
      const hint = "Please use only one.";
      showError(msg, name, { elements: [dfn], hint });
      break;
    }

    // No export wins
    case dfn.matches(".no-export, [data-noexport]"):
      if (dfn.matches("[data-export]")) {
        const msg = docLink`Declares ${"[no-export]"} CSS class, but also has a "${"[data-export]"}" attribute.`;
        const hint = "Please chose only one.";
        showError(msg, name, { elements: [dfn], hint });
        delete dfn.dataset.export;
      }
      dfn.dataset.noexport = "";
      break;

    // If the author explicitly asked for it to be exported, so let's export it.
    case dfn.matches(":is(.export):not([data-noexport], .no-export)"):
      dfn.dataset.export = "";
      break;

    // Auto-suppress export for dfns in explicitly informative sections,
    // but not if a closer normative section overrides the context.
    case isInformativeContext(dfn):
      dfn.dataset.noexport = "";
      break;
  }
}

/**
 * @param {HTMLElement} dfn
 */
function isInformativeContext(dfn) {
  if (dfn.matches(".export, [data-export]")) return false;
  return dfn
    .closest("section.informative, section.normative")
    ?.classList.contains("informative");
}

/**
 * @param {string} text
 * @param {string} type
 * @param {HTMLElement} dfn
 */
function validateDefinition(text, type, dfn) {
  const entry = knownTypesMap.get(type);
  if (entry?.requiresFor && !dfn.dataset.dfnFor) {
    const msg = docLink`Definition of type "\`${type}\`" requires a ${"[data-dfn-for]"} attribute.`;
    const { associateWith } = entry;
    const hint = docLink`Use a ${"[data-dfn-for]"} attribute to associate this with ${associateWith ?? ""}.`;
    showError(msg, name, { hint, elements: [dfn] });
  }

  if (entry?.validator) {
    entry.validator(text, type, dfn, name);
  }
}

/**
 *
 * @param {string} title
 * @param {HTMLElement} dfn
 */
function processAsInternalSlot(title, dfn) {
  if (!dfn.dataset.hasOwnProperty("idl")) {
    dfn.dataset.idl = "";
  }

  // Automatically use the closest data-dfn-for as the parent.
  /** @type {HTMLElement | null} */
  const parent = dfn.closest("[data-dfn-for]");
  if (dfn !== parent && parent?.dataset.dfnFor) {
    dfn.dataset.dfnFor = parent.dataset.dfnFor;
  }

  // Assure that it's data-dfn-for= something.
  if (!dfn.dataset.dfnFor) {
    const msg = `Internal slot "${title}" must be associated with a WebIDL interface.`;
    const hint = docLink`Use a ${"[data-dfn-for]"} attribute to associate this dfn with a WebIDL interface.`;
    showError(msg, name, { hint, elements: [dfn] });
  }

  // Don't export internal slots by default, as they are not supposed to be public.
  if (!dfn.matches(".export, [data-export]")) {
    dfn.dataset.noexport = "";
  }

  // If it ends with a ), then it's method. Attribute otherwise.
  const derivedType = title.endsWith(")") ? "method" : "attribute";
  if (!dfn.dataset.dfnType) {
    return derivedType;
  }

  // Perform validation on the dfn's type.
  const allowedSlotTypes = ["attribute", "method"];
  const { dfnType } = dfn.dataset;
  if (!allowedSlotTypes.includes(dfnType) || derivedType !== dfnType) {
    const msg = docLink`Invalid ${"[data-dfn-type]"} attribute on internal slot.`;
    const prettyTypes = codedJoinOr(allowedSlotTypes, {
      quotes: true,
    });
    const hint = `The only allowed types are: ${prettyTypes}. The slot "${title}" seems to be a "${toMDCode(
      derivedType
    )}"?`;
    showError(msg, name, { hint, elements: [dfn] });
    return "dfn";
  }
  return dfnType;
}

/**
 * Detects whether a dfn has a fully qualified method signature as its text
 * content — e.g., `watchPosition(successCallback, errorCallback)` — and, if
 * so, enriches the element before the normal title-computation pass:
 *
 *   1. Sets `data-lt` to include the bare-name form (`watchPosition()`) so
 *      links like `<a>watchPosition()</a>` resolve to this dfn.
 *   2. Adds the full signature to `data-lt` if it differs from `name()`.
 *   3. Wraps each comma-separated argument name in a `<var>` element.
 *   4. Sets `data-dfn-type="method"` when the author has not set one.
 *
 * This function is a no-op when:
 *   - the dfn already carries a `data-lt` attribute (author override)
 *   - the text doesn't match an identifier followed by `(...)` exactly
 *   - the text matches the internal-slot pattern (`[[...]]`)
 *
 * @param {HTMLElement} dfn
 */
function processQualifiedMethodDfn(dfn) {
  // Respect explicit author overrides.
  if (dfn.dataset.lt) return;

  const rawText = norm(dfn.textContent);

  // Must look like an identifier with parens; internal slots are handled
  // separately by processAsInternalSlot.
  if (slotRegex.test(rawText)) return;

  const match = qualifiedMethodRegex.exec(rawText);
  if (!match) return;

  const [, methodName, argsText] = match;
  const bareMethod = `${methodName}()`;

  // Build the data-lt value. The bare method form is always included.
  // When the dfn text already *is* `name()` we only need that form in lt;
  // otherwise include the full signature as well so it is linkable.
  const ltValues = new Set([bareMethod]);
  if (rawText !== bareMethod) {
    ltValues.add(rawText);
  }
  dfn.dataset.lt = [...ltValues].join("|");

  // The bare identifier (without parens) is a non-exported local alias so
  // that `<a>methodName</a>` can still resolve to this definition.
  const existingLocalLt = dfn.dataset.localLt
    ? dfn.dataset.localLt.split("|")
    : [];
  if (!existingLocalLt.includes(methodName)) {
    dfn.dataset.localLt = [...existingLocalLt, methodName].join("|");
  }

  // Wrap argument names in <var> when the argument list is non-empty.
  const trimmedArgs = argsText.trim();
  if (trimmedArgs) {
    const args = trimmedArgs.split(/\s*,\s*/);
    // Re-build the dfn's inner content: methodName( <var>arg1</var>, ... )
    const { ownerDocument } = dfn;
    dfn.textContent = "";
    dfn.append(`${methodName}(`);
    args.forEach((arg, i) => {
      const varElem = ownerDocument.createElement("var");
      varElem.textContent = arg;
      dfn.append(varElem);
      if (i < args.length - 1) {
        dfn.append(", ");
      }
    });
    dfn.append(")");
  }

  // Default the type to "method" when the author hasn't specified one.
  if (!dfn.dataset.dfnType) {
    dfn.dataset.dfnType = "method";
  }
}
