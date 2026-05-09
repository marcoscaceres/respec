// Module core/webidl
//  Highlights and links WebIDL marked up inside <pre class="idl">.

// TODO:
//  - It could be useful to report parsed IDL items as events
//  - don't use generated content in the CSS!
import {
  addHashId,
  docLink,
  showError,
  showWarning,
  wrapInner,
  xmlEscape,
} from "./utils.js";
import { decorateDfn, findDfn } from "./dfn-finder.js";
import { html, webidl2 } from "./import-maps.js";
import { addCopyIDLButton } from "./webidl-clipboard.js";
import css from "../styles/webidl.css.js";
import { registerDefinition } from "./dfn-map.js";

export const name = "core/webidl";
const pluginName = name;

// Tracks how many times each (qualified-name + type-suffix) combination has
// been seen, to disambiguate overloads that share identical type signatures.
const operationNames = {};
const idlPartials = {};

const templates = {
  wrap(items) {
    return items
      .flat()
      .filter(x => x !== "")
      .map(x => (typeof x === "string" ? new Text(x) : x));
  },
  trivia(t) {
    if (!t.trim()) {
      return t;
    }
    return html`<span class="idlSectionComment">${t}</span>`;
  },
  generic(keyword) {
    // Shepherd classifies "interfaces" as starting with capital letters,
    // like Promise, FrozenArray, etc.
    return /^[A-Z]/.test(keyword)
      ? html`<a data-xref-type="interface" data-cite="WEBIDL">${keyword}</a>`
      : // Other keywords like sequence, maplike, etc...
        html`<a data-xref-type="dfn" data-cite="WEBIDL">${keyword}</a>`;
  },
  reference(wrapped, unescaped, context) {
    if (context.type === "extended-attribute") {
      if (context.name === "Exposed") {
        return html`<a data-link-type="interface" data-xref-type="interface"
          >${wrapped}</a
        >`;
      }
      return wrapped;
    }
    let type = "_IDL_";
    let cite = null;
    let lt;
    switch (unescaped) {
      case "object":
        type = "interface";
        cite = "WEBIDL";
        break;
    }
    return html`<a
      data-link-type="${type === "_IDL_" ? "idl" : type}"
      data-xref-type="${type}"
      data-cite="${cite}"
      data-lt="${lt}"
      >${wrapped}</a
    >`;
  },
  name(escaped, { data, parent }) {
    if (data.idlType && data.idlType.type === "argument-type") {
      return html`<span class="idlParamName">${escaped}</span>`;
    }
    const idlLink = defineIdlName(escaped, data, parent);
    if (data.type !== "enum-value") {
      const className = parent ? "idlName" : "idlID";
      idlLink.classList.add(className);
    }
    return idlLink;
  },
  nameless(escaped, { data, parent }) {
    switch (data.type) {
      case "operation":
      case "constructor":
        return defineIdlName(escaped, data, parent);
      default:
        return escaped;
    }
  },
  type(contents) {
    return html`<span class="idlType">${contents}</span>`;
  },
  inheritance(contents) {
    return html`<span class="idlSuperclass">${contents}</span>`;
  },
  definition(contents, { data, parent }) {
    const className = getIdlDefinitionClassName(data);
    switch (data.type) {
      case "includes":
      case "enum-value":
        return html`<span class="${className}">${contents}</span>`;
    }
    const parentName = parent ? parent.name : "";
    const { name, idlId } = getNameAndId(data, parentName);
    return html`<span
      class="${className}"
      id="${idlId}"
      data-idl
      data-title="${name}"
      >${contents}</span
    >`;
  },
  extendedAttribute(contents) {
    const result = html`<span class="extAttr">${contents}</span>`;
    return result;
  },
  extendedAttributeReference(name) {
    return html`<a data-xref-type="extended-attribute">${name}</a>`;
  },
};

/**
 * Returns a link to existing <dfn> or creates one if doesn’t exists.
 */
function defineIdlName(escaped, data, parent) {
  const parentName = parent ? parent.name : "";
  const { name } = getNameAndId(data, parentName);
  const dfn = findDfn(data, name, {
    parent: parentName,
  });
  const linkType = getDfnType(data.type);
  if (dfn) {
    if (!data.partial) {
      if (!dfn.matches("[data-noexport]")) dfn.dataset.export = "";
      dfn.dataset.dfnType = linkType;
    }
    decorateDfn(dfn, data, parentName, name);
    const href = `#${dfn.id}`;
    return html`<a
      data-link-for="${parentName}"
      data-link-type="${linkType}"
      href="${href}"
      class="internalDFN"
      ><code>${escaped}</code></a
    >`;
  }

  const isDefaultJSON =
    data.type === "operation" &&
    data.name === "toJSON" &&
    data.extAttrs.some(({ name }) => name === "Default");
  if (isDefaultJSON) {
    return html`<a data-link-type="dfn" data-lt="default toJSON steps"
      >${escaped}</a
    >`;
  }
  if (!data.partial) {
    const dfn = html`<dfn data-export data-dfn-type="${linkType}"
      >${escaped}</dfn
    >`;
    registerDefinition(dfn, [name]);
    decorateDfn(dfn, data, parentName, name);
    return dfn;
  }

  const unlinkedAnchor = html`<a
    data-idl="${data.partial ? "partial" : null}"
    data-link-type="${linkType}"
    data-title="${data.name}"
    data-xref-type="${linkType}"
    >${escaped}</a
  >`;

  const showWarnings =
    name && data.type !== "typedef" && !(data.partial && !dfn);
  if (showWarnings) {
    const styledName = data.type === "operation" ? `${name}()` : name;
    const ofParent = parentName ? ` \`${parentName}\`'s` : "";
    const msg = `Missing \`<dfn>\` for${ofParent} \`${styledName}\` ${data.type}.`;
    const hint = docLink`See ${"using `data-dfn-for`|#data-dfn-for"} in ReSpec's documentation.`;
    showWarning(msg, pluginName, { elements: [unlinkedAnchor], hint });
  }
  return unlinkedAnchor;
}

/**
 * Map to Shepherd types, for export.
 * @see https://tabatkins.github.io/bikeshed/#dfn-types
 */
function getDfnType(idlType) {
  switch (idlType) {
    case "operation":
      return "method";
    case "field":
      return "dict-member";
    case "callback interface":
    case "interface mixin":
      return "interface";
    default:
      return idlType;
  }
}

function getIdlDefinitionClassName(defn) {
  switch (defn.type) {
    case "callback interface":
      return "idlInterface";
    case "operation":
      return "idlMethod";
    case "field":
      return "idlMember";
    case "enum-value":
      return "idlEnumItem";
    case "callback function":
      return "idlCallback";
  }
  return `idl${defn.type[0].toUpperCase()}${defn.type.slice(1)}`;
}

const nameResolverMap = new WeakMap();
function getNameAndId(defn, parent = "") {
  if (nameResolverMap.has(defn)) {
    return nameResolverMap.get(defn);
  }
  const result = resolveNameAndId(defn, parent);
  nameResolverMap.set(defn, result);
  return result;
}

function resolveNameAndId(defn, parent) {
  let name = getDefnName(defn);
  // For getters, setters, etc. "anonymous-getter",
  const prefix = defn.special && defn.name === "" ? "anonymous-" : "";
  let idlId = getIdlId(prefix + name, parent);
  switch (defn.type) {
    // Top-level entities with linkable members.
    case "callback interface":
    case "dictionary":
    case "interface":
    case "interface mixin":
    case "namespace": {
      idlId += resolvePartial(defn);
      break;
    }
    case "constructor":
    case "operation": {
      const overload = resolveOverload(name, parent, defn.arguments);
      if (overload) {
        name += overload;
        idlId += overload;
      }
      break;
    }
  }
  return { name, idlId };
}

function resolvePartial(defn) {
  if (!defn.partial) {
    return "";
  }
  if (!idlPartials[defn.name]) {
    idlPartials[defn.name] = 0;
  }
  idlPartials[defn.name] += 1;
  return `-partial-${idlPartials[defn.name]}`;
}

/**
 * Encodes a single WebIDL type into a compact, URL-safe, lowercase string
 * segment suitable for use in an HTML fragment identifier.
 *
 * The encoding scheme mirrors C++ name mangling (Itanium ABI) in spirit:
 * types are encoded deterministically so that the same IDL always produces
 * the same ID, regardless of source order. Concretely:
 *
 *   - Primitive / named types: lowercased verbatim ("short", "domstring").
 *   - Generic types (Promise, sequence, FrozenArray, …): the generic name
 *     followed by each type argument, separated by "-"
 *     (e.g. "Promise<DOMString>" → "promise-domstring").
 *   - Union types: all member types joined by "-"
 *     (e.g. "(DOMString or long)" → "domstring-long").
 *   - Nullable modifier (?) is dropped; it does not affect overload
 *     resolution per the WebIDL spec and keeping it would make IDs verbose.
 *
 * @param {{ generic: string, union: boolean, nullable: boolean, idlType: string | any[] }} idlType
 * @returns {string}
 */
function encodeIdlType(idlType) {
  if (idlType.union) {
    // Union: (A or B or C) — flatten all member types
    return idlType.idlType.map(encodeIdlType).join("-");
  }
  if (idlType.generic) {
    // Generic: Promise<T>, sequence<T>, FrozenArray<T>, etc.
    const inner = idlType.idlType.map(encodeIdlType).join("-");
    return inner
      ? `${idlType.generic.toLowerCase()}-${inner}`
      : idlType.generic.toLowerCase();
  }
  // Plain type name (possibly nullable — nullable is dropped by design).
  return String(idlType.idlType).toLowerCase();
}

/**
 * Builds an overload-disambiguation suffix for a WebIDL operation or
 * constructor.
 *
 * The suffix encodes the parameter *types* (not names) so that:
 *
 *   foo()                          → "" (no suffix — unambiguous zero-arg form)
 *   foo(short s)                   → "!overload-short"
 *   foo(short s, long n)           → "!overload-short-long"
 *   foo(DOMString str, object obj) → "!overload-domstring-object"
 *   foo(Promise<DOMString> p)      → "!overload-promise-domstring"
 *   foo((Dict or boolean) opt)     → "!overload-dict-boolean"
 *
 * If two overloads happen to produce the same type signature (which is a
 * WebIDL validation error in practice, but we handle it defensively),
 * subsequent collisions receive a numeric disambiguator: "!overload-short-2",
 * "!overload-short-3", etc.
 *
 * The "!overload-" prefix preserves compatibility with dfn-finder.js, which
 * uses `name.includes("!overload")` to recognise overloaded operations.
 *
 * @param {string} name - The operation name (e.g. "ull").
 * @param {string} parentName - The interface/mixin name (e.g. "MethBasic").
 * @param {any[]} args - The parsed argument list from the webidl2 AST.
 * @returns {string} - The overload suffix, or "" for a zero-arg operation that
 *   has no same-named sibling.
 */
function resolveOverload(name, parentName, args) {
  const qualifiedName = `${parentName}.${name}`;

  // Compute the type-based portion of the suffix.
  const typePart = args.map(arg => encodeIdlType(arg.idlType)).join("-");

  // The key includes the type signature so same-typed overloads collide.
  const typeKey = `${qualifiedName}!${typePart}`;

  // First time we see this (name, type-signature) pair — no suffix needed
  // when there are no arguments, but we still need to track it.
  if (!operationNames[typeKey]) {
    operationNames[typeKey] = 0;
  }

  const count = operationNames[typeKey];
  operationNames[typeKey] += 1;

  // Zero-argument form with no prior same-typed collision → no suffix.
  if (typePart === "" && count === 0) {
    return "";
  }

  // Non-zero args or collision: build the !overload-… suffix.
  const base = typePart ? `!overload-${typePart}` : "!overload";
  return count === 0 ? base : `${base}-${count + 1}`;
}

function getIdlId(name, parentName) {
  if (!parentName) {
    return `idl-def-${name.toLowerCase()}`;
  }
  return `idl-def-${parentName.toLowerCase()}-${name.toLowerCase()}`;
}

function getDefnName(defn) {
  switch (defn.type) {
    case "enum-value":
      return defn.value;
    case "operation":
      return defn.name || defn.special;
    default:
      return defn.name || defn.type;
  }
}

// IDL types that never need a data-dfn-for
const topLevelIdlTypes = [
  "interface",
  "interface mixin",
  "dictionary",
  "namespace",
  "enum",
  "typedef",
  "callback",
];

/**
 * @param {Element} idlElement
 * @param {number} index
 */
function renderWebIDL(idlElement, index) {
  let parse;
  try {
    parse = webidl2.parse(idlElement.textContent, {
      sourceName: String(index),
    });
  } catch (e) {
    const msg = `Failed to parse WebIDL: ${e.bareMessage}.`;
    showError(msg, pluginName, {
      title: e.bareMessage,
      details: `<pre>${e.context}</pre>`,
      elements: [idlElement],
    });
    // Skip this <pre> and move on to the next one.
    return [];
  }
  // we add "idl" as the canonical match, so both "webidl" and "idl" work
  idlElement.classList.add("def", "idl");
  const highlights = webidl2.write(parse, { templates });
  html.bind(idlElement)`${highlights}`;
  wrapInner(idlElement, document.createElement("code"));
  idlElement.querySelectorAll("[data-idl]").forEach(elem => {
    if (elem.dataset.dfnFor) {
      return;
    }
    const title = elem.dataset.title;
    // Select the nearest ancestor element that can contain members.
    const idlType = elem.dataset.dfnType;

    const parent = elem.parentElement.closest("[data-idl][data-title]");
    if (parent && !topLevelIdlTypes.includes(idlType)) {
      elem.dataset.dfnFor = parent.dataset.title;
    }
    if (elem.localName === "dfn") {
      registerDefinition(elem, [title]);
    }
  });
  // cross reference
  const closestCite = idlElement.closest("[data-cite], body");
  const { dataset } = closestCite;
  if (!dataset.cite) dataset.cite = "WEBIDL";
  // includes webidl in some form
  if (!/\bwebidl\b/i.test(dataset.cite)) {
    const cites = dataset.cite.trim().split(/\s+/);
    dataset.cite = ["WEBIDL", ...cites].join(" ");
  }
  addIDLHeader(idlElement);
  return parse;
}
/**
 * Adds a "WebIDL" decorative header/permalink to a block of WebIDL.
 * @param {HTMLPreElement} pre
 */
export function addIDLHeader(pre) {
  addHashId(pre, "webidl");
  const header = html`<span class="idlHeader"
    ><a class="self-link" href="${`#${pre.id}`}">WebIDL</a></span
  >`;
  pre.prepend(header);
  addCopyIDLButton(header);
}

export async function run() {
  const idls = document.querySelectorAll("pre.idl, pre.webidl");
  if (!idls.length) {
    return;
  }
  const style = document.createElement("style");
  style.textContent = css;
  document.querySelector("head link, head > *:last-child").before(style);

  const astArray = [...idls].map(renderWebIDL);

  const validations = webidl2.validate(astArray);
  for (const validation of validations) {
    let details = `<pre>${xmlEscape(validation.context)}</pre>`;
    if (validation.autofix) {
      validation.autofix();
      const idlToFix = webidl2.write(astArray[validation.sourceName]);
      const escaped = xmlEscape(idlToFix);
      details += `Try fixing as:
      <pre>${escaped}</pre>`;
    }
    const msg = `WebIDL validation error: ${validation.bareMessage}`;
    showError(msg, pluginName, {
      details,
      elements: [idls[validation.sourceName]],
      title: validation.bareMessage,
    });
  }
  document.normalize();
}
