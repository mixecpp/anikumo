import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseEmbedCatalog, sourcesFromCatalog, embedProvider } from "../lib/providers/embeds.ts";
import { aniweebEmbedUrl, remoteEmbedSources, remoteEmbedProvider } from "../lib/providers/remote-embeds.ts";

test("catalog matches exact series and episode and deduplicates URLs", () => {
  const entry = { anilistId: 21, episode: 1, label: "Server A", url: "https://player.example/embed/a" };
  const catalog = parseEmbedCatalog([entry, entry, { ...entry, episode: 2, url: "https://player.example/embed/b" }]);
  assert.equal(sourcesFromCatalog(catalog, 21, 1).length, 1);
  assert.equal(sourcesFromCatalog(catalog, 21, 2)[0].url, "https://player.example/embed/b");
  assert.deepEqual(sourcesFromCatalog(catalog, 22, 1), []);
  assert.deepEqual(sourcesFromCatalog(catalog, 21, 3), []);
});

test("templates respect inclusive episode ranges and expand both placeholders", () => {
  const catalog = parseEmbedCatalog([{ anilistId: 21, firstEpisode: 2, lastEpisode: 4, label: "Sub", urlTemplate: "https://player.example/{anilistId}/{episode}?ep={episode}" }]);
  assert.equal(sourcesFromCatalog(catalog, 21, 2)[0].url, "https://player.example/21/2?ep=2");
  assert.equal(sourcesFromCatalog(catalog, 21, 4).length, 1);
  assert.deepEqual(sourcesFromCatalog(catalog, 21, 1), []);
  assert.deepEqual(sourcesFromCatalog(catalog, 21, 5), []);
});

test("catalog rejects invalid IDs, unsafe URLs and malformed templates", () => {
  const base = { anilistId: 21, episode: 1, label: "Test", url: "https://player.example/e/1" };
  for (const override of [{ anilistId: -1 }, { episode: 1.5 }, { label: " " }, { url: "javascript:alert(1)" }, { url: "http://player.example" }, { url: "https://user:secret@player.example" }, { url: "<iframe></iframe>" }, { note: 42 }]) {
    assert.throws(() => parseEmbedCatalog([{ ...base, ...override }]), /entry 1/);
  }
  for (const urlTemplate of ["https://player.example/{unknown}/{episode}", "https://{episode}.example/embed", "https://{anilistId}.example/{episode}", "https://player.example/static"]) {
    assert.throws(() => parseEmbedCatalog([{ anilistId: 21, label: "Test", firstEpisode: 1, lastEpisode: 5, urlTemplate }]));
  }
  assert.throws(() => parseEmbedCatalog({}));
});

test("provider reads changes immediately and reports configuration failures safely", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "anikumo-embeds-"));
  const previous = process.env.EPISODE_EMBEDS_FILE;
  const filename = path.join(directory, "embeds.json");
  process.env.EPISODE_EMBEDS_FILE = filename;
  try {
    const query = { anilistId: 21, episode: 1 };
    await assert.rejects(embedProvider.getSources(query), /Cannot read/);
    await writeFile(filename, "[]");
    assert.deepEqual(await embedProvider.getSources(query), []);
    await writeFile(filename, JSON.stringify([{ anilistId: 21, episode: 1, label: "New", url: "https://player.example/e" }]));
    assert.equal((await embedProvider.getSources(query))[0].label, "New");
    await writeFile(filename, "{ secret invalid json");
    await assert.rejects(embedProvider.getSources(query), /contains invalid JSON/);
  } finally {
    if (previous === undefined) delete process.env.EPISODE_EMBEDS_FILE;
    else process.env.EPISODE_EMBEDS_FILE = previous;
    await rm(directory, { recursive: true });
  }
});

test("only the Aniweeb SUB entry is returned for each episode", () => {
  const sources = remoteEmbedSources(11061, 50);
  assert.deepEqual(sources.map(s => s.url), [
    "https://api.aniweeb.net/embed/ani/11061/50?track=sub",
  ]);
  assert.ok(sources.every(s => s.kind === "iframe"));
  assert.equal(sources[0].provider, "aniweeb");
  for (const pair of [[0, 1], [1, 0], [1, 1.2], [NaN, 1]]) assert.deepEqual(remoteEmbedSources(...pair), []);
});

test("remote provider excludes episodes beyond a known total", async () => {
  assert.deepEqual(await remoteEmbedProvider.getSources({ anilistId: 1, episode: 27, totalEpisodes: 26 }), []);
  assert.equal((await remoteEmbedProvider.getSources({ anilistId: 1, episode: 1, totalEpisodes: null })).length, 1);
});

test("Aniweeb embed URLs use the documented track and ID namespace", () => {
  assert.equal(aniweebEmbedUrl(21, 2), "https://api.aniweeb.net/embed/ani/21/2?track=sub");
  assert.equal(aniweebEmbedUrl(21, 2, "dub"), "https://api.aniweeb.net/embed/ani/21/2?track=dub");
  assert.equal(aniweebEmbedUrl(21, 3, "dub", "mal"), "https://api.aniweeb.net/embed/mal/21/3?track=dub");
  assert.equal(aniweebEmbedUrl(21, 2, "invalid"), "https://api.aniweeb.net/embed/ani/21/2?track=sub");
});

test("DUB is a track on the single Aniweeb source", async () => {
  const sources = await remoteEmbedProvider.getSources({ anilistId: 21, episode: 1, totalEpisodes: null, audioTrack: "dub" });
  assert.equal(sources.length, 1);
  assert.equal(sources[0].provider, "aniweeb");
  assert.equal(sources[0].url, "https://api.aniweeb.net/embed/ani/21/1?track=dub");
});
