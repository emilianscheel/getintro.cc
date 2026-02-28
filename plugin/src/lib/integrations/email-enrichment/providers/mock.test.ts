import { describe, expect, it } from "vitest";
import { mockEmailLookupProvider } from "./mock";

describe("mock email lookup provider", () => {
  it("returns deterministic dummy emails from name and domain", async () => {
    const controller = new AbortController();

    const emails = await mockEmailLookupProvider.lookupEmails({
      name: "Jane Doe",
      role: "ceo",
      domain: "acme.com",
      signal: controller.signal
    });

    expect(emails.length).toBeGreaterThan(1);
    expect(emails[0]).toContain("acme.com");
    expect(emails[0]).toContain("jane");
  });
});
