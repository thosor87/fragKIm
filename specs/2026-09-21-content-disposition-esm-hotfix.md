# Hotfix: ERR_REQUIRE_ESM durch content-disposition 3.0.0

Datum: 2026-09-21
Status: umgesetzt
Betroffen: Production (`fragkim.lilapixel.de`), Ausfall ab 2026-09-20 18:15 UTC

## Problem

Die Vercel-Function startete nicht mehr. Jeder Request, auch `/healthz` und
statische Assets, endete mit `HTTP 500 FUNCTION_INVOCATION_FAILED`. Der
Runtime-Log zeigt die Ursache:

```
Error [ERR_REQUIRE_ESM]: require() of ES Module
  /var/task/node_modules/content-disposition/dist/index.js
  from /var/task/node_modules/@fastify/static/index.js
```

`@fastify/static` ist CommonJS und lädt `content-disposition` per `require()`.
Mit Version 3.0.0 ist dieses Paket ESM-only (`"type": "module"`, kein
`require`-Export). Damit wirft schon der Import von `backend/dist/server.js`,
bevor Fastify eine Route sieht — deshalb fällt auch der Health-Check aus.

Eingeschleppt hat es PR #94 (`@fastify/static` 10.1.3 → 10.1.4). Das Update
selbst ist nötig, es behebt CVE-2026-90982. Sein neuer Dependency-Range
`content-disposition: ^3.0.0` bringt aber die ESM-only-Version mit.

## Warum Build und CI grün waren

Node unterstützt `require()` von ESM seit 20.19 bzw. 22.12. Lokal und in der
CI bootet der kaputte Stand deshalb sauber (verifiziert auf Node 20, 22, 24 und
25). Vercels Runtime lädt die Function über einen eigenen Loader
(`/opt/rust/nodejs.js`, Bytecode-Cache), der diese Interop nicht kennt. Der
Build war dreimal „success", nur die Runtime war tot.

## Entscheidung

`content-disposition` wird per `overrides` in der Root-`package.json` auf die
letzte CommonJS-Version gepinnt:

```json
"overrides": {
  "esbuild": "^0.28.1",
  "content-disposition": "2.0.1"
}
```

`@fastify/static` bleibt auf 10.1.4, der CVE-Fix bleibt also drin. Die API von
`content-disposition` 2.0.1 ist unverändert (`create` wird als einziges
Symbol genutzt).

### Verworfene Alternativen

**Rollback auf `@fastify/static` 10.1.3.** Würde CVE-2026-90982 wieder
öffnen. Zudem ist `fastify` 5.12.5 aus demselben Zeitraum ebenfalls ein
Security-Release.

**Lockfile per Clean-Install neu erzeugen.** Zieht 74 weitere Versionen mit,
darunter die Majors `fast-json-stringify` 6 → 7 und `fast-uri` 3 → 4. In einem
Hotfix auf einem liegenden System nicht vertretbar. Der Lockfile-Eintrag wurde
stattdessen chirurgisch geändert (4 Zeilen), `npm ci` bestätigt 2.0.1.

## Regressionsschutz

`backend/test/cjs-esm-interop.test.ts` läuft die Dependency-Kette der
registrierten Fastify-Plugins ab und schlägt an, wenn ein CJS-Paket ein
ESM-only-Paket per `require()` lädt. Geprüft werden Paket-Metadaten, nicht
Laufzeitverhalten — letzteres ist Node-versionsabhängig und war genau der
Grund, warum die CI nichts gemerkt hat.

Der Test meldet bewusst **nicht**, wenn ein Paket ein ESM-only-Modul per
dynamischem `import()` lädt. `@fastify/cookie` macht das mit `cookie@2`
korrekt so.

## Verifikation

- RED: Test rot auf dem kaputten Stand, mit genau der Kante aus dem
  Production-Log (`@fastify/static@10.1.4 -> content-disposition@3.0.0`)
- GREEN: Test grün nach dem Override, Suite 234/234
- End-to-End in Docker (Linux, Node 24, also nahe an Vercel): Boot,
  Login, SPA-Shell und gehashtes JS-Asset mit korrektem MIME-Typ

## Offene Folgepunkte

1. **Post-Deploy-Smoke-Test.** `/healthz` ist gut gebaut, wird aber von
   niemandem abgefragt. Ein Check nach jedem Production-Deploy hätte den
   Ausfall in Minuten statt in einer Nacht sichtbar gemacht. Das ist die
   eigentliche Lücke.
2. **Issue upstream** bei `fastify/fastify-static`: ein CJS-Paket sollte keine
   ESM-only-Dependency per `require()` laden. Danach kann der Override wieder
   raus.
3. **Dependabot-Auto-Merge** greift für Minors und Patches ohne
   Deploy-Verifikation. Mit Punkt 1 ist das vertretbar, ohne nicht.
