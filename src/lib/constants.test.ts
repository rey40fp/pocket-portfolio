import { describe, expect, it } from "vitest";
import {
  ACCOUNT_TYPES,
  ASSET_TYPES,
  CUSTODIANS,
  MANUAL_ASSET_TYPES,
  MARKET_ASSET_TYPES,
  USER_ROLES,
  type AssetType,
} from "./constants";

describe("constants", () => {
  it("has four user roles", () => {
    expect(Object.keys(USER_ROLES)).toHaveLength(4);
    expect(USER_ROLES.user).toBe("User");
    expect(USER_ROLES.admin).toBe("Admin");
  });

  it("has eight asset types", () => {
    expect(Object.keys(ASSET_TYPES)).toHaveLength(8);
  });

  it("market + manual asset types cover all asset types", () => {
    const all = [...MARKET_ASSET_TYPES, ...MANUAL_ASSET_TYPES].sort();
    const expected = (Object.keys(ASSET_TYPES) as AssetType[]).sort();
    expect(all).toEqual(expected);
  });

  it("has ten account types", () => {
    expect(Object.keys(ACCOUNT_TYPES)).toHaveLength(10);
  });

  it("has ten custodians", () => {
    expect(Object.keys(CUSTODIANS)).toHaveLength(10);
  });

  it("every map value is a non-empty string label", () => {
    const maps = [USER_ROLES, ASSET_TYPES, ACCOUNT_TYPES, CUSTODIANS];
    for (const map of maps) {
      for (const [key, label] of Object.entries(map)) {
        expect(key).toBeTruthy();
        expect(label.length).toBeGreaterThan(0);
      }
    }
  });
});
