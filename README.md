# THIS WAS MADE NEARLY COMPLETLY BY CLAUDE, AND WAS A AI EXPERIMENT PROJECT


## AniKumo

Anime discovery + watching site. Next.js 15, Prisma/SQLite, AniList metadata.

## Run

```bash
npm install
npx prisma migrate dev
npm run dev
```

Open http://localhost:8080

## Configure (`.env`)

- `LIBRARY_DIR` — folder with your anime files, one subfolder per series. Use single quotes for Windows paths.
- `REMOTE_EMBEDS_ENABLED` — enabled by default; set `false` to disable remote streaming embeds.
- `AUTH_SECRET` — random string used to sign sessions.

## Video playback

Aniweeb is the only streaming source. The backend caches its episode catalog for 30 minutes and player resolution for 10 minutes; concurrent requests share one upstream call. Requests have timeouts and fall back to the standard iframe if the player adapter cannot resolve a supported player. Anime/watch pages use the available episode list, titles and thumbnails when Aniweeb supplies them.

### Player adapter

`lib/playback/server.ts` resolves the normal Aniweeb SUB embed. The current response contains a public player config with a FlixCloud iframe URL. `lib/playback/source.ts` reads only that JSON config without evaluating upstream scripts and only accepts the expected HTTPS host and embed path. The resolved player is loaded directly so the host can use its existing `postMessage` interface; the Aniweeb wrapper does not forward that interface.

The adapter supports observed `getTime`, `getStatus`, `seek`, `volume`, `mute`, `unmute`, and `updatePreferences` commands. Incoming messages must match both the exact iframe window and its origin before they can update watch history. Resume uses `start_at`; skip preferences use `skI`/`skO`; audio uses `a=0` (original) / `a=1` (English) on the same resolved player. These upstream controls are not part of Aniweeb's documented embed API and may change. Unsupported responses keep the standard Aniweeb iframe and show the controls limitation instead of pretending to track playback.

### Account progress and settings

Logged-in users get periodic progress saves (about every 10 seconds), saves on pause and exit, and resume from the stored position. Failed saves are kept in an account-scoped browser queue and retried on reconnect or when another episode is opened. Older sampled positions cannot overwrite a newer save. Requests from an old tab cannot write to a different account after a session change. The watched button toggles both ways while preserving real duration/position. Ordinary progress saves preserve completion; an explicit unmark also updates episode indicators and is not immediately undone by polling a finished position.

**Playback settings** below the video saves account preferences for original/English audio, intro/outro skip, autoplay, next-episode autoplay, resume, volume and mute. Guest preferences stay in this browser. Preference writes are serialized; failed changes can be retried and restored after reloading. Changing audio reloads the same player at the current position. Audio availability depends on the uploaded episode's tracks.

The site's settings are the preferences synchronized to your account. The remote player's own quality, speed and subtitle controls may persist in that provider's browser storage; their internal changes do not emit a synchronization event and cannot be mirrored to your account by this adapter.

Auto-skip uses the player's chapter markers plus optional AniSkip timestamps. Next-episode autoplay waits five seconds and follows the next available episode; turning it off in settings cancels a pending transition. Episode progress indicators update after a successful save. Finished series are removed from Continue Watching when the episode catalog confirms there is no next episode.

Only Aniweeb is registered in `lib/providers/index.ts`. The older providers remain inactive. `REMOTE_EMBEDS_ENABLED=false` disables streaming playback. Metadata still comes from AniList; no stream tokens are decoded, video files proxied or player scripts rewritten.

### Backend endpoints

- `GET /api/sources?id=21&ep=1&track=sub` ? one Aniweeb source, resolved iframe URL, standard fallback and supported-controls flag.
- `GET /api/progress?anilistId=21` / `POST /api/progress` ? account watch progress; finite seconds and integer IDs are validated.
- `GET /api/player/settings` / `PATCH /api/player/settings` ? authenticated account preferences with strict field/type validation.
- `GET /api/skip?malId=21&ep=1` ? cached, validated AniSkip intervals.

The public Aniweeb API is documented at https://api.aniweeb.net/docs. Embedding does not establish that a provider holds distribution rights.

## Verify

```bash
npm test
npm run test:api
npx tsc --noEmit
npm run build
```

Tests use Node 24. `test:api` needs the local dev server and migrated database. It creates two disposable test accounts, checks persistence/isolation/resume/validation/stale writes, and deletes only those accounts in a finally block. Client tests exercise the real hooks with a simulated player message interface and offline requests; they are not a substitute for visual playback checks against the third-party player.

## Production (anikumo.cc)

Branches: work on `main`; **pushing to `production` deploys the live site** within about a minute.

```bash
git push origin main:production
```

The server (`/opt/anikumo`) checks GitHub every minute with a read-only deploy key. When `production` moves it builds the new version next to the live one, backs up the database, runs migrations, switches over and restarts. If the new version doesn't respond it rolls back automatically.

Nothing stateful lives in git:

| What | Where on the server |
| --- | --- |
| Database | `/var/lib/anikumo/anikumo.db` |
| Backups (before every deploy + daily 04:00, keeps 14) | `/var/lib/anikumo/backups/` |
| Production secrets (overrides the committed `.env`) | `/etc/anikumo/anikumo.env` (root only) |
| Tunnel token | `/etc/cloudflared/anikumo.token` (root only) |

Useful commands on the server:

```bash
journalctl -u anikumo-deploy -n 50     # last deploy log
journalctl -u anikumo -f               # live app log
sudo systemctl start anikumo-deploy    # deploy now instead of waiting
sudo /opt/anikumo/bin/deploy.sh --force   # rebuild the current commit
```

First-time setup is `deploy/setup-server.sh` (see the comments at the top). The app listens on `127.0.0.1:3100` only; the public reaches it through the `cloudflared-anikumo` tunnel.
