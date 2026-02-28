import { describe, expect, it } from "vitest";
import { extractEmails } from "./emailRegex";

describe("extractEmails", () => {
  it("extracts and deduplicates email addresses", () => {
    const input =
      "Contact alice@example.com and ALICE@example.com or bob+work@company.co";

    expect(extractEmails(input)).toEqual([
      "alice@example.com",
      "bob+work@company.co"
    ]);
  });
});
