/**
 * glass-ts / blob-editor ship ESM-only export conditions (import, no require/default).
 * tsx runs our worker + custom server as CJS → ERR_PACKAGE_PATH_NOT_EXPORTED.
 * Node can load the same .js files via require once exports allow it.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const pkgs = ["glass-ts", "blob-editor"];

function patchPkg(name) {
  const pkgPath = join(process.cwd(), "node_modules", name, "package.json");
  if (!existsSync(pkgPath)) return false;

  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  if (!pkg.exports || typeof pkg.exports !== "object") return false;

  let changed = false;
  const next = { ...pkg.exports };

  for (const [key, val] of Object.entries(pkg.exports)) {
    if (typeof val === "string") continue; // e.g. CSS path
    if (!val || typeof val !== "object") continue;
    const importPath = val.import;
    if (typeof importPath !== "string") continue;
    if (val.require === importPath && val.default === importPath) continue;
    next[key] = {
      ...val,
      require: importPath,
      default: importPath,
    };
    changed = true;
  }

  if (!changed) return false;
  pkg.exports = next;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`patched ${name} package exports for CJS/tsx`);
  return true;
}

for (const name of pkgs) patchPkg(name);
