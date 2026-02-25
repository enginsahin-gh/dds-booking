# Setup Guide — DDS Boekingssysteem

## 1. Supabase Project

1. Maak een nieuw project op [supabase.com](https://supabase.com)
2. Ga naar **SQL Editor** en voer de migrations uit in volgorde:
   - `supabase/migrations/001_create_tables.sql`
   - `supabase/migrations/002_create_rls_policies.sql`
   - `supabase/migrations/003_create_booking_function.sql`
   - `supabase/migrations/004_create_views.sql`
3. Kopieer je **Project URL** en **Anon Key** uit Settings → API

## 2. Environment Variables

Kopieer `.env.example` naar `.env`:

```bash
cp .env.example .env
```

Vul in:
- `VITE_SUPABASE_URL` — je Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — je Supabase anon key

## 3. Eerste Salon Aanmaken

1. Maak een gebruiker aan in Supabase Auth (Authentication → Users → Add user)
2. Voeg een salon record toe via SQL Editor:

```sql
INSERT INTO salons (slug, name, email, phone, owner_id)
VALUES ('mijn-salon', 'Mijn Salon', 'info@mijnsalon.nl', '0612345678', 'USER_UUID_HIER');
```

## 4. Lokaal Ontwikkelen

```bash
npm install
npm run dev
```

Admin: `http://localhost:5173/admin`

## 5. Deployen naar Netlify

1. Verbind de Git repo met Netlify
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Stel environment variables in via Netlify Dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SMTP_HOST` (mail.ensalabs.nl)
   - `SMTP_PORT` (587)
   - `SMTP_USER` (boekingen@ensalabs.nl)
   - `SMTP_PASS`
   - `EMAIL_SECRET` (**verplicht** — shared secret voor email function authenticatie)

## 6. Widget Embedden

### SRI (Subresource Integrity)

After every deploy, generate SRI hashes:

```bash
npm run build:sri
```

This prints the `integrity` hashes for `embed.js`, `widget.js`, and `widget.css`. Use them in the embed tag for maximum security.

### Embed Tag

Voeg dit toe aan de salon website:

```html
<script src="https://boeken.ensalabs.nl/embed.js" integrity="sha384-..." crossorigin="anonymous" data-salon="mijn-salon"></script>
```

Optionele theming attributen:
- `data-color-primary="#8B5CF6"`
- `data-color-bg="#FFFFFF"`
- `data-color-text="#1F2937"`
- `data-font="Inter, sans-serif"`
- `data-radius="12"`
