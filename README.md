# Resacolo AI Image Studio

Next.js application that transforms images with the Replicate model and stores results in Supabase.

## Installation

```bash
npm install
npm run dev
```

All dependencies are listed in `package.json`. Available scripts:

- `npm run dev` – start the development server
- `npm run build` – create the production build
- `npm run start` – run the production server
- `npm run lint` – run ESLint (Next.js default config)

## Configuration

Required variables are defined in `.env.local`. Update them as needed:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_INPUT_BUCKET=input-images
SUPABASE_OUTPUT_BUCKET=output-images
REPLICATE_API_TOKEN=
REPLICATE_MODEL=google/nano-banana:1bwy6kt8r9rm80crx16t6161tm..
```

## Architecture

- `app/page.tsx`: landing interface with upload, prompt, and output rendering.
- `app/api/generate/route.ts`: serverless API that stores the source image in Supabase, calls Replicate, and saves the result.
- `lib/supabase-admin.ts`: Supabase client (service role) for server-side operations.

The `input-images` bucket stores source files, `output-images` stores generated visuals, and the `projects` table tracks each run.

## Security

The API uses the service role key. Never ship this file without additional safeguards (private environment variables, RLS, etc.).
