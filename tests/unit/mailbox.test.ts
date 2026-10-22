import { describe, expect, it } from "vitest";
import { MAILBOXES, isMailboxKey, mailboxKeyFor, platformFor } from "@/lib/mailbox";

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

describe("which device is asking", () => {
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  const android = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
  const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
  const windows = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

  it("tells phones from computers", () => {
    expect(platformFor(iphone)).toBe("ios");
    expect(platformFor(android)).toBe("android");
    expect(platformFor(mac)).toBe("desktop");
    expect(platformFor(windows)).toBe("desktop");
    expect(platformFor("")).toBe("desktop");
  });

  it("treats an iPad asking for the desktop site as an iPhone-class device, because it has a touch screen", () => {
    expect(platformFor(mac, 5)).toBe("ios");
    expect(platformFor(mac, 0)).toBe("desktop");
  });

  it("keeps an app link only where a provider has one, as a real scheme", () => {
    for (const key of Object.keys(MAILBOXES) as (keyof typeof MAILBOXES)[]) expect(MAILBOXES[key].iosApp).toMatch(/^[a-z-]+:\/\//);
  });
});
