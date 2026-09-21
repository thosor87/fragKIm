import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Schutz gegen ESM-only-Transitive in der CommonJS-Plugin-Kette.
 *
 * Hintergrund: @fastify/static ist CommonJS und lädt content-disposition per
 * require(). Mit content-disposition 3.0.0 wurde das Paket ESM-only, wodurch
 * die Vercel-Function beim Import mit ERR_REQUIRE_ESM starb — und zwar bei
 * jedem Request, auch bei /healthz. Lokal und in der CI fiel das nicht auf,
 * weil Node seit 20.19/22.12 require(esm) unterstützt; Vercels Runtime-Loader
 * tut das nicht.
 *
 * Der Test prüft daher nicht das Laufzeitverhalten (das ist Node-abhängig),
 * sondern die Paket-Metadaten: kein CJS-Paket in der Kette der registrierten
 * Fastify-Plugins darf von einem Paket abhängen, das ausschliesslich ESM
 * anbietet.
 *
 * Gemeldet wird nur, wenn das CJS-Paket die Abhängigkeit auch tatsächlich
 * per require() lädt. @fastify/cookie etwa hängt an cookie@2 (ESM-only),
 * umgeht das aber bewusst mit einem dynamischen import() — das ist korrekt
 * und darf den Test nicht rot machen.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Die Plugins, die server.ts registriert, plus Fastify selbst.
const ROOTS = [
  "fastify",
  "@fastify/static",
  "@fastify/cookie",
  "@fastify/formbody",
  "@fastify/multipart",
];

type PkgJson = {
  name?: string;
  version?: string;
  type?: string;
  exports?: unknown;
  dependencies?: Record<string, string>;
};

/** Sucht das Paketverzeichnis wie Node: node_modules nach oben durchlaufen. */
function findPkgDir(name: string, fromDir: string): string | null {
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(dir, "node_modules", name);
    if (existsSync(path.join(candidate, "package.json"))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function readPkg(dir: string): PkgJson {
  return JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8"));
}

/** Gibt es irgendwo in der exports-Map eine "require"-Bedingung? */
function hasRequireCondition(exports: unknown): boolean {
  if (!exports || typeof exports !== "object") return false;
  for (const [key, value] of Object.entries(exports as Record<string, unknown>)) {
    if (key === "require") return true;
    if (hasRequireCondition(value)) return true;
  }
  return false;
}

function isCommonJs(pkg: PkgJson): boolean {
  return pkg.type !== "module";
}

const SKIP_DIRS = new Set(["node_modules", "test", "tests", "benchmark", "docs", ".github"]);

/** Alle Quelldateien eines Pakets, ohne Tests und verschachtelte Pakete. */
function packageSources(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(path.join(current, entry.name));
      } else if (/\.(js|cjs)$/.test(entry.name)) {
        out.push(path.join(current, entry.name));
      }
    }
  };
  walk(dir);
  return out;
}

/**
 * Lädt das Paket die Abhängigkeit per require()? Ein dynamisches import()
 * ist der korrekte Weg zu einem ESM-only-Paket und zählt nicht.
 */
function requiresStatically(pkgDir: string, depName: string): boolean {
  const pattern = new RegExp(
    `require\\(\\s*['"\`]${depName.replace(/[/\\.]/g, "\\$&")}['"\`]`,
  );
  return packageSources(pkgDir).some((file) =>
    pattern.test(readFileSync(file, "utf8")),
  );
}

/** ESM-only: als Modul deklariert und ohne require-Einstieg. */
function isEsmOnly(pkg: PkgJson): boolean {
  if (pkg.type !== "module") return false;
  return !hasRequireCondition(pkg.exports);
}

function collectViolations(): string[] {
  const violations: string[] = [];
  const seen = new Set<string>();
  const queue: Array<{ name: string; fromDir: string }> = ROOTS.map((name) => ({
    name,
    fromDir: __dirname,
  }));

  while (queue.length > 0) {
    const { name, fromDir } = queue.shift()!;
    const dir = findPkgDir(name, fromDir);
    if (!dir || seen.has(dir)) continue;
    seen.add(dir);

    const pkg = readPkg(dir);
    for (const depName of Object.keys(pkg.dependencies ?? {})) {
      const depDir = findPkgDir(depName, dir);
      if (!depDir) continue;
      const dep = readPkg(depDir);

      if (isCommonJs(pkg) && isEsmOnly(dep) && requiresStatically(dir, depName)) {
        violations.push(
          `${pkg.name}@${pkg.version} (CJS) -> ${dep.name}@${dep.version} (ESM-only)`,
        );
      }
      queue.push({ name: depName, fromDir: dir });
    }
  }
  return violations.sort();
}

describe("CJS/ESM-Interop der Fastify-Plugin-Kette", () => {
  it("findet die erwarteten Wurzel-Pakete im Baum", () => {
    for (const name of ROOTS) {
      expect(findPkgDir(name, __dirname), `${name} nicht installiert`).not.toBeNull();
    }
  });

  it("enthält kein CJS-Paket, das von einem ESM-only-Paket abhängt", () => {
    const violations = collectViolations();
    expect(
      violations,
      `ESM-only-Abhängigkeit in der CJS-Kette:\n  ${violations.join("\n  ")}\n` +
        "Gegenmittel: die letzte CJS-Version des Pakets per overrides in der " +
        "Root-package.json pinnen.",
    ).toEqual([]);
  });
});
