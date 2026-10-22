import { describe, expect, it } from "vitest";
import { MAILBOXES, isMailboxKey, mailboxKeyFor } from "@/lib/mailbox";

describe("web inbox for an address", () => {
  it("recognises the common providers, whatever the case or spaces", () => {
    expect(mailboxKeyFor("astakn2525@gmail.com")).toBe("gmail");
    expect(mailboxKeyFor("  Nour@GMAIL.COM ")).toBe("gmail");
    expect(mailboxKeyFor("a+b@googlemail.com")).toBe("gmail");
    expect(mailboxKeyFor("x@hotmail.fr")).toBe("outlook");
    expect(mailboxKeyFor("x@yahoo.com")).toBe("yahoo");
    expect(mailboxKeyFor("x@icloud.com")).toBe("icloud");
  });

  it("offers nothing for other or malformed addresses", () => {
    expect(mailboxKeyFor("x@salon-nour.dz")).toBeNull();
    expect(mailboxKeyFor("x@notgmail.com")).toBeNull();
    expect(mailboxKeyFor("x@gmail.com.evil.test")).toBeNull();
    expect(mailboxKeyFor("no-at-sign")).toBeNull();
    expect(mailboxKeyFor("")).toBeNull();
  });

  it("only ever points to the providers' own https addresses", () => {
    for (const key of Object.keys(MAILBOXES) as (keyof typeof MAILBOXES)[]) expect(MAILBOXES[key].url).toMatch(/^https:\/\/[a-z.]+\//);
  });

  it("accepts only known keys from storage", () => {
    expect(isMailboxKey("gmail")).toBe(true);
    expect(isMailboxKey("javascript:alert(1)")).toBe(false);
    expect(isMailboxKey(null)).toBe(false);
    expect(isMailboxKey("constructor")).toBe(false);
  });
});
