-- Check current data state
SELECT 'Cases count:' as info, COUNT(*) as count FROM public.cases
UNION ALL
SELECT 'Documents count:', COUNT(*) FROM public.case_documents
UNION ALL
SELECT 'Analyses count:', COUNT(*) FROM public.case_analysis;

-- Show actual data
SELECT 'CASES:' as type, id, case_name, case_number, status, created_at FROM public.cases
UNION ALL
SELECT 'DOCUMENTS:', cd.id, cd.file_name, cd.document_type, cd.case_id::text, cd.created_at
FROM public.case_documents cd;

-- Check if there's an orphaned document (document without a case)
SELECT
    cd.id as doc_id,
    cd.file_name,
    cd.case_id,
    CASE
        WHEN c.id IS NULL THEN 'ORPHANED - No matching case'
        ELSE 'OK - Case exists'
    END as status
FROM public.case_documents cd
LEFT JOIN public.cases c ON c.id = cd.case_id;

-- If we need to create test data, uncomment below:
/*
-- Create a test case
INSERT INTO public.cases (
    case_name,
    case_number,
    description,
    status,
    priority,
    incident_date,
    agency_id,
    user_id
) VALUES (
    'Test Cold Case',
    'CC-2024-001',
    'Test case for development and debugging',
    'active',
    'high',
    '2024-01-15',
    (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid() LIMIT 1),
    auth.uid()
)
RETURNING id, case_name, case_number;
*/
