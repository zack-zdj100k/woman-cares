import { describe, expect, it } from "vitest";
import { pinSslMode } from "@/lib/db";

describe("pinSslMode", () => {
  it("says verify-full for the modes the pg driver will weaken", () => {
    expect(pinSslMode("postgresql://u:p@h/db?sslmode=require")).toBe("postgresql://u:p@h/db?sslmode=verify-full");
    expect(pinSslMode("postgresql://u:p@h/db?sslmode=prefer&channel_binding=require")).toBe("postgresql://u:p@h/db?sslmode=verify-full&channel_binding=require");
    expect(pinSslMode("postgresql://u:p@h/db?x=1&sslmode=verify-ca")).toBe("postgresql://u:p@h/db?x=1&sslmode=verify-full");
  });
  it("leaves local and already-strict URLs alone", () => {
    expect(pinSslMode("postgresql://u:p@localhost:5432/db?schema=public")).toBe("postgresql://u:p@localhost:5432/db?schema=public");
    expect(pinSslMode("postgresql://u:p@h/db?sslmode=verify-full")).toBe("postgresql://u:p@h/db?sslmode=verify-full");
    expect(pinSslMode("postgresql://u:p@h/db?sslmode=disable")).toBe("postgresql://u:p@h/db?sslmode=disable");
  });
});
