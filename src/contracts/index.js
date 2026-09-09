/*
  The contracts barrel. One import for a downstream role rather than five:

    import { normalizeEvent, migrate, toJSON, DEFAULT_SETTINGS } from "../contracts/index.js";

  Deep imports stay valid and stay fine — src/lib/store.js reaches straight
  into ./schema.js and ./serialize.js, because a barrel in a module the store
  depends on is a cycle waiting to happen. Use the barrel from feature code,
  the direct path from inside the contracts and from src/lib.

  Nothing is defined here. If you find yourself wanting to, it belongs in one
  of the five modules below.
*/
export * from "./schema.js";
export * from "./serialize.js";
export * from "./migrate.js";
export * from "./defaults.js";
export * from "./source.js";
