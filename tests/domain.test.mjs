import test from "node:test";
import assert from "node:assert/strict";
import { deriveStatus, isSafeOfficialUrl, verificationCanPublish } from "../src/domain.mjs";

test("deadline status becomes closing soon and then expired", () => {
  assert.equal(deriveStatus({ deadline: "2026-10-12", editorialStatus: "published" }, new Date("2026-10-07T12:00:00Z")), "CLOSING SOON");
  assert.equal(deriveStatus({ deadline: "2026-10-06", editorialStatus: "published" }, new Date("2026-10-07T12:00:00Z")), "EXPIRED");
});

test("unsafe and mismatched application URLs are rejected", () => {
  assert.equal(isSafeOfficialUrl("http://nitda.gov.ng/apply", "nitda.gov.ng"), false);
  assert.equal(isSafeOfficialUrl("https://evil.example/apply", "nitda.gov.ng"), false);
  assert.equal(isSafeOfficialUrl("https://apply.nitda.gov.ng/programme", "nitda.gov.ng"), true);
});

test("publishing requires human evidence and a sufficient score", () => {
  const opportunity = { editorialStatus: "approved", officialSourceUrl: "https://nitda.gov.ng/source", applicationUrl: "https://apply.nitda.gov.ng/programme", officialDomain: "nitda.gov.ng" };
  const evidence = { reviewerId: 1, primarySourceUrl: opportunity.officialSourceUrl, programmeOwner: "NITDA", deadlineConfirmed: true, score: 92 };
  assert.equal(verificationCanPublish(opportunity, evidence), true);
  assert.equal(verificationCanPublish(opportunity, { ...evidence, reviewerId: null }), false);
  assert.equal(verificationCanPublish(opportunity, { ...evidence, score: 60 }), false);
});
