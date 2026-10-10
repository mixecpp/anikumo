# AnimeWeb

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
- `YOUTUBE_API_KEY` — optional; finds licensed free full episodes on official channels (Muse Asia, Ani-One, etc.).
- `AUTH_SECRET` — random string used to sign sessions.

## Video sources

Sources are pluggable providers in `lib/providers/`. Each implements the `Provider` interface in `lib/providers/types.ts`
and is registered in `lib/providers/index.ts`. Built in:

| Provider | What it does |
|---|---|
| `local` | Streams files from `LIBRARY_DIR` (range requests, SRT/VTT subtitles) |
| `youtube` | Embeds official free uploads from allow-listed channels |
| `official` | Deep links to Crunchyroll/Netflix/etc. from AniList |
