-- Cold Case Cracker Database Schema for Supabase

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    badge_number TEXT UNIQUE,
    department TEXT,
    role TEXT DEFAULT 'investigator' CHECK (role IN ('admin', 'investigator', 'analyst', 'viewer')),
    avatar_url TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Cases table
CREATE TABLE public.cases (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    case_number TEXT UNIQUE NOT NULL,
    incident_date DATE,
    location TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cold', 'reviewing', 'closed', 'solved')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    assigned_to UUID REFERENCES public.profiles(id),
    created_by UUID REFERENCES public.profiles(id) NOT NULL,
    tags TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,
    ai_analysis_status TEXT DEFAULT 'pending' CHECK (ai_analysis_status IN ('pending', 'analyzing', 'complete', 'failed')),
    ai_analysis_results JSONB DEFAULT '{}'::jsonb,
    ai_last_analyzed TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Files table
CREATE TABLE public.case_files (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'image', 'video', 'audio', 'document', 'other'
    file_size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    storage_path TEXT NOT NULL, -- Path in Supabase storage
    storage_bucket TEXT DEFAULT 'case-files' NOT NULL,
    uploaded_by UUID REFERENCES public.profiles(id) NOT NULL,
    description TEXT,
    tags TEXT[],
    metadata JSONB DEFAULT '{}'::jsonb,
    ai_analyzed BOOLEAN DEFAULT FALSE,
    ai_analysis_results JSONB DEFAULT '{}'::jsonb,
    ai_analysis_confidence DECIMAL(3,2), -- 0.00 to 1.00
    ai_extracted_text TEXT, -- For OCR results
    ai_detected_objects JSONB DEFAULT '[]'::jsonb, -- For image/video analysis
    ai_transcription TEXT, -- For audio/video files
    checksum TEXT, -- File integrity verification
    is_evidence BOOLEAN DEFAULT TRUE,
    chain_of_custody JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Case activity log
CREATE TABLE public.case_activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    action TEXT NOT NULL, -- 'created', 'updated', 'file_uploaded', 'ai_analysis_started', etc.
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- AI analysis jobs queue
CREATE TABLE public.ai_analysis_jobs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
    file_id UUID REFERENCES public.case_files(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL, -- 'image_analysis', 'text_extraction', 'audio_transcription', 'pattern_detection'
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    priority INTEGER DEFAULT 1,
    parameters JSONB DEFAULT '{}'::jsonb,
    results JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Suspects/Persons of Interest
CREATE TABLE public.persons_of_interest (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
    name TEXT,
    aliases TEXT[],
    description TEXT,
    known_associates TEXT[],
    physical_description JSONB DEFAULT '{}'::jsonb,
    last_known_location TEXT,
    status TEXT DEFAULT 'person_of_interest' CHECK (status IN ('person_of_interest', 'suspect', 'witness', 'victim')),
    ai_identified BOOLEAN DEFAULT FALSE,
    ai_confidence DECIMAL(3,2),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.profiles(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Evidence links (connections between files, cases, and persons)
CREATE TABLE public.evidence_links (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    source_type TEXT NOT NULL CHECK (source_type IN ('case', 'file', 'person')),
    source_id UUID NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('case', 'file', 'person')),
    target_id UUID NOT NULL,
    relationship_type TEXT NOT NULL, -- 'contains', 'references', 'similar_to', 'connected_to'
    confidence DECIMAL(3,2), -- AI confidence score
    metadata JSONB DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX idx_cases_status ON public.cases(status);
CREATE INDEX idx_cases_priority ON public.cases(priority);
CREATE INDEX idx_cases_assigned_to ON public.cases(assigned_to);
CREATE INDEX idx_cases_created_by ON public.cases(created_by);
CREATE INDEX idx_cases_ai_analysis_status ON public.cases(ai_analysis_status);

CREATE INDEX idx_case_files_case_id ON public.case_files(case_id);
CREATE INDEX idx_case_files_file_type ON public.case_files(file_type);
CREATE INDEX idx_case_files_ai_analyzed ON public.case_files(ai_analyzed);
CREATE INDEX idx_case_files_uploaded_by ON public.case_files(uploaded_by);

CREATE INDEX idx_case_activities_case_id ON public.case_activities(case_id);
CREATE INDEX idx_case_activities_user_id ON public.case_activities(user_id);
CREATE INDEX idx_case_activities_created_at ON public.case_activities(created_at);

CREATE INDEX idx_ai_analysis_jobs_status ON public.ai_analysis_jobs(status);
CREATE INDEX idx_ai_analysis_jobs_priority ON public.ai_analysis_jobs(priority);
CREATE INDEX idx_ai_analysis_jobs_case_id ON public.ai_analysis_jobs(case_id);

-- Row Level Security (RLS) Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_analysis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persons_of_interest ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_links ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users