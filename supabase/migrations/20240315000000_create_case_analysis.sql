-- Create case_analysis table
create table case_analysis (
  id uuid default uuid_generate_v4() primary key,
  case_id text not null,
  analysis_type text not null,
  analysis_data jsonb not null,
  confidence_score integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users(id)
);

-- Create index on case_id for faster lookups
create index case_analysis_case_id_idx on case_analysis(case_id);

-- Create index on user_id for faster lookups
create index case_analysis_user_id_idx on case_analysis(user_id);

-- Add RLS policies
alter table case_analysis enable row level security;

-- Allow users to view their own analyses
create policy "Users can view their own analyses"
  on case_analysis for select
  using (auth.uid() = user_id);

-- Allow users to insert their own analyses
create policy "Users can insert their own analyses"
  on case_analysis for insert
  with check (auth.uid() = user_id);

-- Allow users to update their own analyses
create policy "Users can update their own analyses"
  on case_analysis for update
  using (auth.uid() = user_id);

-- Allow users to delete their own analyses
create policy "Users can delete their own analyses"
  on case_analysis for delete
  using (auth.uid() = user_id); 