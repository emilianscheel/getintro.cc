import { describe, expect, it } from "vitest";
import { inferNameFromEmailAddress } from "./inferNameFromEmail";

describe("inferNameFromEmailAddress", () => {
  it("infers name from local part when it is person-like", () => {
    expect(inferNameFromEmailAddress("emma.johnson@acme.com")).toBe("Emma Johnson");
  });

  it("infers name from domain when local part is generic", () => {
    expect(inferNameFromEmailAddress("info@vera-scheel.de")).toBe("Vera Scheel");
  });

  it("returns undefined when no person-like signal exists", () => {
    expect(inferNameFromEmailAddress("support@acme.com")).toBeUndefined();
  });
});
