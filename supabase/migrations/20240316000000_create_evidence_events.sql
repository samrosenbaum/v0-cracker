-- Drop existing table if it exists
drop table if exists evidence_events;

-- Create evidence_events table
create table evidence_events (
  id uuid default uuid_generate_v4() primary key,
  case_id text not null,
  date date not null,
  time time,
  type text not null check (type in ('collection', 'transfer', 'analysis', 'match', 'report', 'degradation', 'other')),
  title text not null,
  description text not null,
  location text,
  personnel text,
  sample_id text,
  status text check (status in ('completed', 'pending', 'failed')),
  priority text check (priority in ('low', 'medium', 'high')),
  tags text[],
  related_events uuid[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users(id)
);

-- Create indexes for faster lookups
create index if not exists evidence_events_case_id_idx on evidence_events(case_id);
create index if not exists evidence_events_date_idx on evidence_events(date);
create index if not exists evidence_events_type_idx on evidence_events(type);
create index if not exists evidence_events_status_idx on evidence_events(status);
create index if not exists evidence_events_user_id_idx on evidence_events(user_id);

-- Add RLS policies
alter table evidence_events enable row level security;

-- Drop existing policies if they exist
drop policy if exists "Users can view their own events" on evidence_events;
drop policy if exists "Users can insert their own events" on evidence_events;
drop policy if exists "Users can update their own events" on evidence_events;
drop policy if exists "Users can delete their own events" on evidence_events;

-- Allow users to view their own events
create policy "Users can view their own events"
  on evidence_events for select
  using (auth.uid() = user_id);

-- Allow users to insert their own events
create policy "Users can insert their own events"
  on evidence_events for insert
  with check (auth.uid() = user_id);

-- Allow users to update their own events
create policy "Users can update their own events"
  on evidence_events for update
  using (auth.uid() = user_id);

-- Allow users to delete their own events
create policy "Users can delete their own events"
  on evidence_events for delete
  using (auth.uid() = user_id); 