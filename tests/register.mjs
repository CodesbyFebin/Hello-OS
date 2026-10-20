// Lets node --test import app code that uses the "@/..." path alias and extensionless .ts imports.
import { register } from "node:module";
register("./alias-hooks.mjs", import.meta.url);
