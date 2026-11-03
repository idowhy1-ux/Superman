// Redirect @minecraft/* imports to the mock runtime when running in Node.
import { register } from "node:module";
register(new URL("./loader.mjs", import.meta.url));
