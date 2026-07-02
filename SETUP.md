# Game Art Guidebook - Setup Instructions

The project already ships with a working Supabase backend that contains the sample chapters/pages. You can simply run `npm install` and `npm run dev` with no additional configuration.

If you want to connect the app to **your own** Supabase project instead, follow the optional steps below.

## Optional: Bring your own Supabase

### 1. Create Supabase Project

Go to [supabase.com](https://supabase.com) and spin up a project.

### 2. Run Database Migration

In your Supabase project's SQL Editor, run the following migration:

```sql
-- Create profiles table
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null default 'user' check (role in ('admin','user')),
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Create chapters table
create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  index_num int not null,
  created_at timestamptz default now()
);

alter table public.chapters enable row level security;

-- Create pages table
create table public.pages (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid references public.chapters(id) on delete cascade,
  title text not null,
  slug text unique not null,
  index_num int not null,
  content_md text not null default '',
  updated_at timestamptz default now()
);

alter table public.pages enable row level security;

-- RLS Policies: Any authenticated user can read
create policy "read_all_auth" on public.chapters
  for select using (auth.role() = 'authenticated');

create policy "read_all_auth_pages" on public.pages
  for select using (auth.role() = 'authenticated');

-- RLS Policies: Only admins can write
create policy "admins_write_chapters" on public.chapters
  for all using (
    exists (
      select 1 from public.profiles p 
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p 
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "admins_write_pages" on public.pages
  for all using (
    exists (
      select 1 from public.profiles p 
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p 
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- RLS Policies: Users can read their own profile
create policy "users_read_own_profile" on public.profiles
  for select using (auth.uid() = id);

-- RLS Policies: Users can update their own profile (for admin elevation)
create policy "users_update_own_profile" on public.profiles
  for update using (auth.uid() = id);
```

### 3. Configure Environment Variables

The repository already contains a `.env` stub. Uncomment the lines and paste your own anon key if you want to override the default credentials:

```env
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
VITE_ADMIN_EMAILS=your-email@example.com
```

> Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to your own project values when switching away from the default backend.

### 4. Configure Auth Settings (Recommended)

In Supabase Dashboard → Authentication → Settings:

1. **Disable email confirmation** for faster testing:
   - Uncheck "Enable email confirmations"
   
2. **Set Site URL**:
   - Add your development URL (e.g., `http://localhost:8080`)
   
3. **Add Redirect URLs**:
   - Add allowed redirect URLs for auth callbacks

### 5. Start Development

```bash
npm install
npm run dev
```

## Admin Access

**First-time setup:**

1. Sign up for an account
2. If you're the first user OR your email is in `VITE_ADMIN_EMAILS`, you'll see a "Set as Admin" button
3. Click it to gain admin privileges

**Admin features:**
- Create and edit chapters
- Create and edit pages
- Reorder content

## Architecture Notes

- **Auth**: Email/password via Supabase Auth
- **Database**: PostgreSQL with Row Level Security (RLS)
- **Storage**: Supabase-backed and override-ready
- **Realtime**: Disabled by default for performance
- **Admin detection**: First user or `VITE_ADMIN_EMAILS` list

## Troubleshooting

**"Supabase Setup Required" screen:**
- Check that your `.env` file exists and has correct values
- Restart your dev server after adding/changing env vars

**Can't see data:**
- Verify RLS policies are correctly applied
- Check that you're authenticated
- For admin actions, verify your profile has `role = 'admin'`

**Login issues:**
- Ensure Site URL and Redirect URLs are configured in Supabase Auth settings
- Check browser console for detailed error messages

## Tech Stack

- React 18 + TypeScript
- Tailwind CSS (warm pastel theme)
- Supabase (Auth + Database)
- React Markdown (content rendering)
- React Router (navigation)
