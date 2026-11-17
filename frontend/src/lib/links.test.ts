import { describe, expect, it } from "vitest";

import { websiteHref, websiteLabel } from "./links";

describe("website links", () => {
  it("links http and https websites", () => {
    expect(websiteHref("https://www.atlasfreight.example.com")).toBe("https://www.atlasfreight.example.com/");
    expect(websiteHref("http://acme.example.com/about")).toBe("http://acme.example.com/about");
    expect(websiteHref("acme.example.com")).toBe("https://acme.example.com/");
    expect(websiteLabel("https://www.acme.example.com/")).toBe("www.acme.example.com");
  });

  it("keeps javascript: and other text as plain text", () => {
    expect(websiteHref("javascript:alert(1)")).toBeNull();
    expect(websiteHref("JavaScript:alert(1)")).toBeNull();
    expect(websiteHref("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(websiteHref("ftp://files.example.com")).toBeNull();
    expect(websiteHref("our website")).toBeNull();
    expect(websiteHref("")).toBeNull();
    expect(websiteHref(null)).toBeNull();
  });
});
