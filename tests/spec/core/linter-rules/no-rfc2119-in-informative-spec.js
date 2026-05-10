"use strict";

import {
  errorFilters,
  flushIframes,
  makeRSDoc,
  makeStandardOps,
  warningFilters,
} from "../../SpecHelper.js";

describe("Core — linter-rules — no-rfc2119-in-informative", () => {
  const ruleName = "no-rfc2119-in-informative";
  const pluginName = `core/linter-rules/${ruleName}`;
  const lintErrors = errorFilters.filter(pluginName);
  const lintWarnings = warningFilters.filter(pluginName);

  afterAll(() => {
    flushIframes();
  });

  it("does nothing when the rule is disabled (default)", async () => {
    const body = `
      <section class="informative">
        <h2>Background</h2>
        <p>Implementations MUST do the thing.</p>
      </section>
      <section id="conformance"><h2>Conformance</h2></section>`;
    // lint: true enables the linter but this rule is not opted in
    const ops = makeStandardOps({ lint: true }, body);
    const doc = await makeRSDoc(ops);
    expect(lintWarnings(doc)).toHaveSize(0);
  });

  it("does nothing when the rule is explicitly set to false", async () => {
    const body = `
      <section class="informative">
        <h2>Background</h2>
        <p>Implementations MUST do the thing.</p>
      </section>
      <section id="conformance"><h2>Conformance</h2></section>`;
    const ops = makeStandardOps({ lint: { [ruleName]: false } }, body);
    const doc = await makeRSDoc(ops);
    expect(lintWarnings(doc)).toHaveSize(0);
  });

  it("warns when the rule is set to 'warn'", async () => {
    const body = `
      <section class="informative">
        <h2>Background</h2>
        <p>Implementations MUST do the thing.</p>
      </section>
      <section id="conformance"><h2>Conformance</h2></section>`;
    const ops = makeStandardOps({ lint: { [ruleName]: "warn" } }, body);
    const doc = await makeRSDoc(ops);
    expect(lintErrors(doc)).toHaveSize(0);
    expect(lintWarnings(doc)).toHaveSize(1);
  });

  it("shows as error when the rule is set to 'error'", async () => {
    const body = `
      <section class="informative">
        <h2>Background</h2>
        <p>Implementations MUST do the thing.</p>
      </section>
      <section id="conformance"><h2>Conformance</h2></section>`;
    const ops = makeStandardOps({ lint: { [ruleName]: "error" } }, body);
    const doc = await makeRSDoc(ops);
    expect(lintErrors(doc)).toHaveSize(1);
    expect(lintWarnings(doc)).toHaveSize(0);
  });

  it("warns when an RFC 2119 keyword appears in an .informative section", async () => {
    const body = `
      <section class="informative">
        <h2>Background</h2>
        <p>Implementations MUST do the thing.</p>
      </section>
      <section id="conformance"><h2>Conformance</h2></section>`;
    const ops = makeStandardOps({ lint: { [ruleName]: true } }, body);
    const doc = await makeRSDoc(ops);
    const warnings = lintWarnings(doc);
    expect(warnings).toHaveSize(1);
    expect(warnings[0].message).toContain("RFC 2119 keywords");
    expect(warnings[0].elements).toHaveSize(1);
    expect(warnings[0].elements[0].textContent).toBe("MUST");
  });

  it("warns for multiple RFC 2119 keywords in the same informative section", async () => {
    const body = `
      <section class="informative">
        <h2>Overview</h2>
        <p>Implementations MUST do this and SHOULD do that.</p>
      </section>
      <section id="conformance"><h2>Conformance</h2></section>`;
    const ops = makeStandardOps({ lint: { [ruleName]: true } }, body);
    const doc = await makeRSDoc(ops);
    const warnings = lintWarnings(doc);
    expect(warnings).toHaveSize(1);
    expect(warnings[0].elements).toHaveSize(2);
  });

  it("does not warn when RFC 2119 keywords are in a normative section", async () => {
    const body = `
      <section>
        <h2>Requirements</h2>
        <p>Implementations MUST do the thing.</p>
      </section>
      <section id="conformance"><h2>Conformance</h2></section>`;
    const ops = makeStandardOps({ lint: { [ruleName]: true } }, body);
    const doc = await makeRSDoc(ops);
    expect(lintWarnings(doc)).toHaveSize(0);
  });

  it("does not warn when RFC 2119 keywords are in a .normative section nested inside an informative section", async () => {
    const body = `
      <section class="informative">
        <h2>Background</h2>
        <p>This is informative text with no keywords.</p>
        <section class="normative">
          <h3>Exception</h3>
          <p>This subsection is normative. Implementations MUST do the thing.</p>
        </section>
      </section>
      <section id="conformance"><h2>Conformance</h2></section>`;
    const ops = makeStandardOps({ lint: { [ruleName]: true } }, body);
    const doc = await makeRSDoc(ops);
    expect(lintWarnings(doc)).toHaveSize(0);
  });

  it("warns for keywords in informative section but not in nested normative subsection", async () => {
    const body = `
      <section class="informative">
        <h2>Background</h2>
        <p>Implementations MUST do the thing.</p>
        <section class="normative">
          <h3>Exception</h3>
          <p>Implementations MUST also do this other thing.</p>
        </section>
      </section>
      <section id="conformance"><h2>Conformance</h2></section>`;
    const ops = makeStandardOps({ lint: { [ruleName]: true } }, body);
    const doc = await makeRSDoc(ops);
    const warnings = lintWarnings(doc);
    expect(warnings).toHaveSize(1);
    // Only the keyword in the outer informative section should be flagged
    expect(warnings[0].elements).toHaveSize(1);
    expect(warnings[0].elements[0].closest(".normative")).toBeNull();
  });

  it("suppresses warning when the keyword element is inside a .lint-ignore element", async () => {
    const body = `
      <section class="informative">
        <h2>Background</h2>
        <p class="lint-ignore">Implementations MUST do the thing.</p>
        <p>But implementations SHOULD also do this.</p>
      </section>
      <section id="conformance"><h2>Conformance</h2></section>`;
    const ops = makeStandardOps({ lint: { [ruleName]: true } }, body);
    const doc = await makeRSDoc(ops);
    const warnings = lintWarnings(doc);
    expect(warnings).toHaveSize(1);
    expect(warnings[0].elements).toHaveSize(1);
    expect(warnings[0].elements[0].textContent).toBe("SHOULD");
  });

  it("warns for keywords inside .note, .example, and other non-normative contexts", async () => {
    const body = `
      <section>
        <h2>Requirements</h2>
        <div class="note">
          <p>Implementations MUST do the thing.</p>
        </div>
      </section>
      <section id="conformance"><h2>Conformance</h2></section>`;
    const ops = makeStandardOps({ lint: { [ruleName]: true } }, body);
    const doc = await makeRSDoc(ops);
    const warnings = lintWarnings(doc);
    expect(warnings).toHaveSize(1);
    expect(warnings[0].elements[0].textContent).toBe("MUST");
  });

  it("warns for all RFC 2119 keywords: MUST NOT, SHALL, SHALL NOT, SHOULD NOT, MAY, REQUIRED, RECOMMENDED, OPTIONAL", async () => {
    const body = `
      <section class="informative">
        <h2>Overview</h2>
        <p>This MUST NOT be done. You SHALL NOT pass. This SHOULD NOT happen.
           This is REQUIRED. This is RECOMMENDED. This is OPTIONAL.
           You MAY do this.</p>
      </section>
      <section id="conformance"><h2>Conformance</h2></section>`;
    const ops = makeStandardOps({ lint: { [ruleName]: true } }, body);
    const doc = await makeRSDoc(ops);
    const warnings = lintWarnings(doc);
    expect(warnings).toHaveSize(1);
    // 7 keywords: MUST NOT, SHALL NOT, SHOULD NOT, REQUIRED, RECOMMENDED, OPTIONAL, MAY
    expect(warnings[0].elements).toHaveSize(7);
  });
});
