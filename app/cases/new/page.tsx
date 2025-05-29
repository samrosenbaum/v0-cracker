'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function NewCasePage() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [location, setLocation] = useState('');
  const [jurisdiction, setJurisdiction] = useState('');
  const [caseType, setCaseType] = useState('');
  const [status, setStatus] = useState('Active');
  const [priority, setPriority] = useState('Medium');
  const [assignedDetective, setAssignedDetective] = useState('');
  const [tags, setTags] = useState('');
  const [formStatus, setFormStatus] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data, error } = await supabase
      .from('cases')
      .insert([{
        title,
        description,
        case_number: caseNumber,
        incident_date: incidentDate || null,
        location,
        jurisdiction,
        case_type: caseType,
        status,
        priority,
        assigned_detective: assignedDetective,
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        user_id: user.id
      }])
      .select()
      .single();

    if (error) {
      setFormStatus(`Error: ${error.message}`);
    } else {
      router.push(`/cases/${data.id}`);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Create New Case</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Case Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        <input
          type="text"
          placeholder="Case Number"
          value={caseNumber}
          onChange={(e) => setCaseNumber(e.target.value)}
          className="w-full border p-2 rounded"
        />
        <input
          type="date"
          placeholder="Incident Date"
          value={incidentDate}
          onChange={(e) => setIncidentDate(e.target.value)}
          className="w-full border p-2 rounded"
        />
        <input
          type="text"
          placeholder="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full border p-2 rounded"
        />
        <input
          type="text"
          placeholder="Jurisdiction"
          value={jurisdiction}
          onChange={(e) => setJurisdiction(e.target.value)}
          className="w-full border p-2 rounded"
        />
        <input
          type="text"
          placeholder="Case Type"
          value={caseType}
          onChange={(e) => setCaseType(e.target.value)}
          className="w-full border p-2 rounded"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full border p-2 rounded"
        >
          <option value="Active">Active</option>
          <option value="Closed">Closed</option>
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="w-full border p-2 rounded"
        >
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <input
          type="text"
          placeholder="Assigned Detective"
          value={assignedDetective}
          onChange={(e) => setAssignedDetective(e.target.value)}
          className="w-full border p-2 rounded"
        />
        <input
          type="text"
          placeholder="Tags (comma separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="w-full border p-2 rounded"
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border p-2 rounded"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Create Case
        </button>
        <p className="text-sm text-red-600">{formStatus}</p>
      </form>
    </div>
  );
}
