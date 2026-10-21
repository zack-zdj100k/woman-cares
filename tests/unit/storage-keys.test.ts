import { describe, expect, it } from "vitest";
import { cloudNameFrom, deliveryPath, extensionOf, formatFor, publicIdFor, resourceTypeFor } from "@/lib/storage/cloudinary-keys";

describe("Cloudinary key mapping", () => {
  it("sorts our storage keys into image, video and raw", () => {
    expect(resourceTypeFor("profiles/a/b.webp")).toBe("image");
    expect(resourceTypeFor("profiles/a/b.mp4")).toBe("video");
    expect(resourceTypeFor("profiles/a/b.mov")).toBe("video");
    expect(resourceTypeFor("receipts/a/b.pdf")).toBe("raw");
    expect(resourceTypeFor("demo/frame-1.jpg")).toBe("image");
  });

  it("keeps the format apart for images and videos, inside the id for documents", () => {
    expect(publicIdFor("bookings/x/y.webp")).toBe("bookings/x/y");
    expect(formatFor("bookings/x/y.webp")).toBe("webp");
    expect(publicIdFor("receipts/x/y.pdf")).toBe("receipts/x/y.pdf");
    expect(formatFor("receipts/x/y.pdf")).toBeUndefined();
  });

  it("builds the delivery path the CDN serves", () => {
    expect(deliveryPath("profiles/x/y.webp")).toBe("profiles/x/y.webp");
    expect(deliveryPath("profiles/x/y.mp4")).toBe("profiles/x/y.mp4");
    expect(deliveryPath("receipts/x/y.pdf")).toBe("receipts/x/y.pdf");
  });

  it("leaves keys without an extension, and dotfiles, alone", () => {
    expect(extensionOf("profiles/x/y")).toBe("");
    expect(publicIdFor("profiles/x/y")).toBe("profiles/x/y");
    expect(extensionOf("profiles/x/.hidden")).toBe("");
  });

  it("reads only the cloud name from the credentials URL", () => {
    expect(cloudNameFrom("cloudinary://123456789:s3cr3t@woman-cares")).toBe("woman-cares");
    expect(cloudNameFrom(undefined)).toBeNull();
    expect(cloudNameFrom("not a url")).toBeNull();
  });
});
