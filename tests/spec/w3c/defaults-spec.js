"use strict";

import {
  W3CNotes,
  cgbgStatus,
  registryTrackStatus,
  tagStatus,
} from "../../../src/w3c/headers.js";

import {
  errorFilters,
  flushIframes,
  makeDefaultBody,
  makeRSDoc,
  makeStandardOps,
} from "../SpecHelper.js";
const errorsFilter = errorFilters.filter("w3c/defaults");

describe("W3C — Defaults", () => {
  afterAll(flushIframes);
  it("sets sensible defaults for w3c specs", async () => {
    const ops = {
      config: { editors: [{ name: "foo" }], specStatus: "base" },
      body: makeDefaultBody(),
    };
    const doc = await makeRSDoc(ops);
    const rsConf = doc.defaultView.respecConfig;
    expect(rsConf.lint).toEqual({
      "privsec-section": false,
      "no-headingless-sections": true,
      "no-http-props": true,
      "no-unused-vars": false,
      "local-refs-exist": true,
      "check-punctuation": false,
      "check-internal-slots": false,
      "check-charset": false,
      "wpt-tests-exist": false,
      "no-unused-dfns": "warn",
      "required-sections": true,
      "informative-dfn": "warn",
      a11y: false,
      "no-dfn-in-abstract": false,
    });
    expect(rsConf.highlightVars).toBe(true);
    expect(rsConf.license).toBe("w3c-software-doc");
    expect(rsConf.specStatus).toBe("base");
    expect(rsConf.addSectionLinks).toBe(true);
    expect(rsConf.xref).toBe(true);
  });

  it("allows w3c defaults to be overridden", async () => {
    const ops = {
      config: {
        editors: [{ name: "foo" }],
        lint: {
          "privsec-section": false,
          "no-http-props": false,
          "local-refs-exist": true,
          "check-punctuation": false,
          "fake-linter-rule": "foo",
          "check-internal-slots": true,
          "no-unused-dfns": "error",
          "informative-dfn": false,
          "required-sections": "warn",
        },
        license: "c0",
        specStatus: "ED",
        shortName: "foo",
        highlightVars: false,
      },
      body: makeDefaultBody(),
    };
    const doc = await makeRSDoc(ops);
    const rsConf = doc.defaultView.respecConfig;
    expect(rsConf.lint).toEqual({
      "no-headingless-sections": true,
      "privsec-section": false,
      "no-http-props": false,
      "no-unused-vars": false,
      "local-refs-exist": true,
      "check-punctuation": false,
      "informative-dfn": false,
      "fake-linter-rule": "foo",
      "check-internal-slots": true,
      "check-charset": false,
      "wpt-tests-exist": false,
      "no-unused-dfns": "error",
      "required-sections": "warn",
      a11y: false,
      "no-dfn-in-abstract": false,
    });
    expect(rsConf.highlightVars).toBe(false);
    expect(rsConf.license).toBe("c0");
    expect(rsConf.specStatus).toBe("base");
  });

  it("doesn't show the W3C logo if no group or an invalid group is specified", async () => {
    const ops = makeStandardOps({ specStatus: "WD" });
    const docNoGroup = await makeRSDoc(ops);
    expect(docNoGroup.querySelector("img[alt='W3C']")).toBeNull();
  });

  it("doesn't show the W3C logo an unknown group is specified", async () => {
    const ops = makeStandardOps({
      specStatus: "WD",
      group: "not a real group",
    });
    const doc = await makeRSDoc(ops);
    expect(doc.querySelector("img[alt='W3C']")).toBeNull();
  });

  it("shows the W3C logo if a valid group and specStatus is specified", async () => {
    const ops = makeStandardOps({
      specStatus: "WD",
      group: "css",
    });
    const doc = await makeRSDoc(ops);
    expect(doc.querySelector("img[alt='W3C']")).not.toBeNull();
  });

  it("allows W3C TAG to show logos", async () => {
    for (const specStatus of [...tagStatus, "ED"]) {
      const ops = makeStandardOps({
        specStatus,
        group: "tag",
      });
      const doc = await makeRSDoc(ops);
      expect(doc.querySelector("img[alt='W3C']")).not.toBeNull();
    }
  });

  it("doesn't allow the W3C TAG to show logo when status is from another group type", async () => {
    for (const specStatus of cgbgStatus) {
      const ops = makeStandardOps({
        specStatus,
        group: "tag",
      });
      const doc = await makeRSDoc(ops);
      expect(doc.querySelector("img[alt='W3C']")).toBeNull();
    }
  });

  it("warns when using a W3C specStatus, but no group is configured and defaults to 'base'", async () => {
    const ops = makeStandardOps({ specStatus: "WD" });
    const doc = await makeRSDoc(ops);
    const errors = errorsFilter(doc);
    expect(errors).toHaveSize(1);
    expect(errors[0].message).toContain(
      "Document is not associated with a [W3C group]"
    );
    const config = doc.defaultView.respecConfig;
    expect(config.specStatus).toBe("base");
  });

  it("errors when specStatus is missing, and defaults to 'base' for the specStatus", async () => {
    const ops = makeStandardOps({
      editors: [{ name: "foo" }],
      specStatus: "",
    });
    const doc = await makeRSDoc(ops);
    const errors = errorsFilter(doc);
    expect(errors).toHaveSize(1);
    expect(errors[0].message).toContain(
      "#specStatus) configuration option is required"
    );
    const config = doc.defaultView.respecConfig;
    expect(config.specStatus).toBe("base");
  });

  it("requires that a group option be in the configuration", async () => {
    for (const specStatus of cgbgStatus) {
      const ops = makeStandardOps({
        shortName: "foo",
        specStatus,
        latestVersion: "somewhere",
      });
      const doc = await makeRSDoc(ops);
      const errors = errorsFilter(doc);
      expect(errors).withContext(specStatus).toHaveSize(1);
      expect(errors[0].message)
        .withContext(specStatus)
        .toContain("s not associated with a [W3C group](");
    }
  });

  describe("group type / specStatus validation", () => {
    describe("CG", () => {
      it("errors when a CG uses a WG-only status", async () => {
        const ops = makeStandardOps({ group: "wicg", specStatus: "WD" });
        const doc = await makeRSDoc(ops);
        const errors = errorsFilter(doc);
        const mismatchError = errors.find(e =>
          e.message.includes("Community Group documents can't use")
        );
        expect(mismatchError).toBeTruthy();
        expect(doc.defaultView.respecConfig.specStatus).toBe("CG-DRAFT");
      });

      it("does not error when a CG uses CG-DRAFT", async () => {
        const ops = makeStandardOps({ group: "wicg", specStatus: "CG-DRAFT" });
        const doc = await makeRSDoc(ops);
        const errors = errorsFilter(doc);
        const mismatchError = errors.find(e =>
          e.message.includes("Community Group documents can't use")
        );
        expect(mismatchError).toBeUndefined();
      });

      it("does not error when a CG uses unofficial", async () => {
        const ops = makeStandardOps({
          group: "wicg",
          specStatus: "unofficial",
        });
        const doc = await makeRSDoc(ops);
        const errors = errorsFilter(doc);
        const mismatchError = errors.find(e =>
          e.message.includes("Community Group documents can't use")
        );
        expect(mismatchError).toBeUndefined();
      });
    });

    describe("BG", () => {
      it("errors when a BG uses a WG-only status", async () => {
        // publishingbg is the W3C Publishing Business Group
        const ops = makeStandardOps({
          group: "publishingbg",
          specStatus: "ED",
        });
        const doc = await makeRSDoc(ops);
        const errors = errorsFilter(doc);
        const mismatchError = errors.find(e =>
          e.message.includes("Business Group documents can't use")
        );
        expect(mismatchError).toBeTruthy();
        expect(doc.defaultView.respecConfig.specStatus).toBe("BG-DRAFT");
      });
    });

    describe("WG", () => {
      it("errors when a WG uses a CG-only status", async () => {
        const ops = makeStandardOps({
          group: "webapps",
          specStatus: "CG-DRAFT",
        });
        const doc = await makeRSDoc(ops);
        const errors = errorsFilter(doc);
        const mismatchError = errors.find(e =>
          e.message.includes("Working Group documents can't use")
        );
        expect(mismatchError).toBeTruthy();
      });

      it("does not error when a WG uses WD", async () => {
        const ops = makeStandardOps({ group: "webapps", specStatus: "WD" });
        const doc = await makeRSDoc(ops);
        const errors = errorsFilter(doc);
        const mismatchError = errors.find(e =>
          e.message.includes("Working Group documents can't use")
        );
        expect(mismatchError).toBeUndefined();
      });

      it("does not error when a WG uses ED", async () => {
        const ops = makeStandardOps({ group: "webapps", specStatus: "ED" });
        const doc = await makeRSDoc(ops);
        const errors = errorsFilter(doc);
        const mismatchError = errors.find(e =>
          e.message.includes("Working Group documents can't use")
        );
        expect(mismatchError).toBeUndefined();
      });
    });

    describe("IG", () => {
      it("errors when an IG uses a Rec-track status", async () => {
        // Inject groupType directly: IGs don't appear in test fixtures, so we
        // bypass the API and set groupType + wgId to simulate a resolved IG.
        for (const specStatus of ["WD", "CR", "PR", "REC"]) {
          const ops = makeStandardOps({
            groupType: "ig",
            wgId: "1",
            specStatus,
          });
          const doc = await makeRSDoc(ops);
          const errors = errorsFilter(doc);
          const mismatchError = errors.find(e =>
            e.message.includes("Interest Group documents can't use")
          );
          expect(mismatchError)
            .withContext(`specStatus: ${specStatus}`)
            .toBeTruthy();
        }
      });

      it("does not error when an IG uses a Note-track status", async () => {
        for (const specStatus of W3CNotes) {
          const ops = makeStandardOps({
            groupType: "ig",
            wgId: "1",
            specStatus,
          });
          const doc = await makeRSDoc(ops);
          const errors = errorsFilter(doc);
          const mismatchError = errors.find(e =>
            e.message.includes("Interest Group documents can't use")
          );
          expect(mismatchError)
            .withContext(`specStatus: ${specStatus}`)
            .toBeUndefined();
        }
      });

      it("does not error when an IG uses ED", async () => {
        const ops = makeStandardOps({
          groupType: "ig",
          wgId: "1",
          specStatus: "ED",
        });
        const doc = await makeRSDoc(ops);
        const errors = errorsFilter(doc);
        const mismatchError = errors.find(e =>
          e.message.includes("Interest Group documents can't use")
        );
        expect(mismatchError).toBeUndefined();
      });

      it("does not error when an IG uses a Registry-track status", async () => {
        for (const specStatus of registryTrackStatus) {
          const ops = makeStandardOps({
            groupType: "ig",
            wgId: "1",
            specStatus,
          });
          const doc = await makeRSDoc(ops);
          const errors = errorsFilter(doc);
          const mismatchError = errors.find(e =>
            e.message.includes("Interest Group documents can't use")
          );
          expect(mismatchError)
            .withContext(`specStatus: ${specStatus}`)
            .toBeUndefined();
        }
      });
    });

    describe("heterogeneous group arrays", () => {
      it("errors when group array mixes a CG and a WG", async () => {
        // Inject groupType array directly to bypass API; this simulates
        // group: ["wicg", "webapps"] where types resolve to ["cg", "wg"].
        const ops = makeStandardOps({
          groupType: ["cg", "wg"],
          wgId: ["1", "2"],
          specStatus: "WD",
        });
        const doc = await makeRSDoc(ops);
        const errors = errorsFilter(doc);
        const mixedError = errors.find(e =>
          e.message.includes("mixes Community/Business Groups")
        );
        expect(mixedError).toBeTruthy();
      });

      it("does not error when group array contains only WGs", async () => {
        const ops = makeStandardOps({
          group: ["webapps", "payments"],
          specStatus: "WD",
        });
        const doc = await makeRSDoc(ops);
        const errors = errorsFilter(doc);
        const mixedError = errors.find(e =>
          e.message.includes("mixes Community/Business Groups")
        );
        expect(mixedError).toBeUndefined();
      });

      it("does not error when group array contains only CGs", async () => {
        // Inject groupType array directly to simulate two CGs.
        const ops = makeStandardOps({
          groupType: ["cg", "cg"],
          wgId: ["1", "2"],
          specStatus: "CG-DRAFT",
        });
        const doc = await makeRSDoc(ops);
        const errors = errorsFilter(doc);
        const mixedError = errors.find(e =>
          e.message.includes("mixes Community/Business Groups")
        );
        expect(mixedError).toBeUndefined();
      });
    });
  });
});
