# Music Web Backend

Backend API for the personal music web app. The music catalog now uses Supabase for the free PostgreSQL database and Storage buckets.

## Tech Stack

- Node.js
- Express
- Supabase PostgreSQL through REST
- Supabase Storage for MP3 and cover images
- Multer for upload parsing
- JWT/Prisma modules are still present for local learning, but music upload/listing does not require local PostgreSQL.

## Supabase Setup

1. Create a free Supabase project.
2. Open `SQL Editor` in Supabase.
3. Paste and run the SQL in `backend/supabase.sql`.
4. Go to `Project Settings > API`.
5. Copy:
   - Project URL
   - `service_role` secret key

The SQL creates:

- `tracks` table (including optional `genre`, used by the frontend filters)
- `increment_track_plays()` RPC
- public `audio` bucket
- public `covers` bucket

## Environment

Create or update `backend/.env`:

```env
PORT=4000
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
JWT_SECRET=change-this-secret-before-production
JWT_EXPIRES_IN=7d

ADMIN_UPLOAD_KEY=dev-admin-key
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-public-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_AUDIO_BUCKET=audio
SUPABASE_COVER_BUCKET=covers
```

Keep `SUPABASE_SERVICE_ROLE_KEY` private. Do not put it in frontend code.
`SUPABASE_PUBLISHABLE_KEY` is intentionally exposed to the browser by the auth
configuration endpoint; it is safe to expose and is required for Supabase Auth.

## User Authentication

The frontend shows a sign-in screen before loading the catalog. It supports
email/password registration, email/password sign-in, session persistence on the
current browser, and Google OAuth through Supabase Auth.

For Google sign-in, configure both services:

1. In Google Cloud, create a Web OAuth client. Add the app origin (for example
   `http://localhost:5500`) under Authorized JavaScript origins. Add
   `https://<project-ref>.supabase.co/auth/v1/callback` under Authorized redirect URIs.
2. In Supabase Dashboard, open Authentication > Providers > Google, enable it,
   and paste that client ID and secret.
3. In Supabase Dashboard, open Authentication > URL Configuration. Set your
   app URL as Site URL and add the same URL to Redirect URLs. The browser uses
   its current origin as the callback destination.

## Run

```bash
cd backend
npm install
npm run dev
```

API base URL:

```text
http://localhost:4000/api
```

After filling in your Supabase credentials and running the SQL, verify the
connection with:

```bash
curl http://localhost:4000/api/health/supabase
```

It returns a successful response only when the project URL/key are valid and
the `tracks` table can be read.

## Music Endpoints

- `GET /api/music/tracks`
- `GET /api/music/tracks/:id`
- `POST /api/music/tracks`
- `POST /api/music/tracks/upload`
- `PUT /api/music/tracks/:id`
- `DELETE /api/music/tracks/:id`
- `POST /api/music/tracks/:id/play`

Create/update/delete/upload require the admin key:

```http
x-admin-key: dev-admin-key
```

## Upload A Track

Use `multipart/form-data`:

```text
POST http://localhost:4000/api/music/tracks/upload
Header: x-admin-key: dev-admin-key

Fields:
title      Song title
artist     Artist name
album      Album name, optional
duration   Duration in seconds
audio      MP3/WAV/OGG file
cover      JPG/PNG/WEBP file, optional
```

PowerShell example:

```powershell
curl.exe -X POST http://localhost:4000/api/music/tracks/upload `
  -H "x-admin-key: dev-admin-key" `
  -F "title=Demo Song" `
  -F "artist=Me" `
  -F "album=Personal" `
  -F "duration=180" `
  -F "audio=@C:\Music\demo.mp3" `
  -F "cover=@C:\Music\cover.jpg"
```

## Frontend Catalog

The static frontend fetches tracks from:

```text
http://localhost:4000/api/music/tracks
```

After a successful upload, refresh the frontend and the new track should appear automatically.
