import { describe, it, expect, beforeAll } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import formbody from "@fastify/formbody";
import { createHash } from "node:crypto";

/**
 * Der Login-Endpoint akzeptiert form-urlencoded (HTML-Formular der Login-Seite)
 * UND JSON. Das urlencoded-Parsing kommt allein von @fastify/formbody — ohne
 * das Plugin liefert Fastify 415 und der Login über die Login-Seite ist tot.
 * Dieser Test hält den Vertrag fest, damit ein Major-Update des Plugins nicht
 * still den Login abschaltet.
 */

const PASSWORD = "test-passwort-123";
const EXPECTED_TOKEN = createHash("sha256").update(PASSWORD).digest("hex");

let app: FastifyInstance;

beforeAll(async () => {
  process.env.DEMO_PASSWORD = PASSWORD;
  const { registerAuth } = await import("../src/auth.js");

  app = Fastify();
  await app.register(fastifyCookie);
  await app.register(formbody);
  registerAuth(app);
  await app.ready();
});

describe("POST /api/login – Body-Parsing", () => {
  it("nimmt das Passwort aus einem form-urlencoded Body an", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/login",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: `password=${encodeURIComponent(PASSWORD)}`,
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe("/");
    expect(res.headers["set-cookie"]).toContain(EXPECTED_TOKEN);
  });

  it("nimmt das Passwort auch aus einem JSON-Body an", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: { password: PASSWORD },
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers["set-cookie"]).toContain(EXPECTED_TOKEN);
  });

  it("setzt bei falschem urlencoded-Passwort keine Session", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/login",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "password=falsch",
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("setzt bei leerem urlencoded-Body keine Session", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/login",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "",
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });
});
