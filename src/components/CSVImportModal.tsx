"use client";

import React, { useState, useRef } from 'react';
import { X, Upload, Check, AlertTriangle, ArrowRight, Loader2, Info } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { Lead } from '@/types/crm';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Target lead fields that can be mapped
const MAPPABLE_FIELDS = [
  { key: 'name', label: 'Student Name *', required: true, type: 'string' },
  { key: 'phone', label: 'Phone Number *', required: true, type: 'string' },
  { key: 'email', label: 'Email Address', required: false, type: 'string' },
  { key: 'parent_contact', label: 'Parent Contact', required: false, type: 'string' },
  { key: 'whatsapp_number', label: 'WhatsApp Number', required: false, type: 'string' },
  { key: 'neet_marks', label: 'NEET Marks', required: false, type: 'number' },
  { key: 'budget', label: 'Budget (Total, e.g. 5000000)', required: false, type: 'number' },
  { key: 'preferred_destination', label: 'Preferred Destination', required: false, type: 'string' },
  { key: 'course', label: 'Course Name', required: false, type: 'string' },
  { key: 'lead_source', label: 'Lead Source', required: false, type: 'string' },
  { key: 'status', label: 'Lead Status/Stage', required: false, type: 'string' },
  { key: 'tags', label: 'Tags (comma separated)', required: false, type: 'tags' },
  { key: 'score', label: 'Lead Score (0-100)', required: false, type: 'number' },
];

export const CSVImportModal: React.FC<CSVImportModalProps> = ({ isOpen, onClose }) => {
  const { bulkAddLeads, leads, profiles, pipelines, updateLead, teams, teamMembers } = useData();
  
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [csvFileName, setCsvFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  
  // Mapping state: maps target field key -> CSV header index (number as string, or empty string if unmapped)
  const [mapping, setMapping] = useState<Record<string, string>>({});
  
  // Import settings
  const [duplicateStrategy, setDuplicateStrategy] = useState<'update' | 'skip'>('update');
  const [selectedPipelineId, setSelectedPipelineId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [importAssignmentMode, setImportAssignmentMode] = useState<'unassigned' | 'individual' | 'split'>('unassigned');
  const [importSelectedCounsellorId, setImportSelectedCounsellorId] = useState('');
  const [importSplitTargets, setImportSplitTargets] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; updated: number; skipped: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Simple CSV Parser (RFC 4180 compliant)
  const parseCSV = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [];
    let col = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          col += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(col.trim());
        col = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip \n
        }
        row.push(col.trim());
        if (row.length > 0 && (row.length > 1 || row[0] !== '')) {
          lines.push(row);
        }
        row = [];
        col = '';
      } else {
        col += char;
      }
    }

    if (col !== '' || row.length > 0) {
      row.push(col.trim());
      lines.push(row);
    }

    return lines;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const allRows = parseCSV(text);
      if (allRows.length < 2) {
        alert("The CSV file must contain at least a header row and one data row.");
        return;
      }

      const fileHeaders = allRows[0];
      const dataRows = allRows.slice(1);

      setHeaders(fileHeaders);
      setCsvRows(dataRows);

      // Perform intelligent auto-mapping
      const initialMapping: Record<string, string> = {};
      MAPPABLE_FIELDS.forEach(field => {
        // Find index of CSV header that matches name
        const matchIdx = fileHeaders.findIndex(header => {
          const h = header.toLowerCase().replace(/[^a-z0-9]/g, '');
          const f = field.key.toLowerCase().replace(/[^a-z0-9]/g, '');
          const label = field.label.toLowerCase().replace(/[^a-z0-9]/g, '');

          return h === f || 
                 h.includes(f) || 
                 f.includes(h) || 
                 h.includes('student') && f === 'name' || 
                 h.includes('phone') && f === 'phone' ||
                 h.includes('email') && f === 'email' ||
                 h.includes('destination') && f === 'preferred_destination' ||
                 h.includes('marks') && f === 'neet_marks';
        });

        if (matchIdx !== -1) {
          initialMapping[field.key] = matchIdx.toString();
        } else {
          initialMapping[field.key] = '';
        }
      });

      setMapping(initialMapping);
      
      // Select default pipeline
      const defaultPipe = pipelines.find(p => p.is_default) || pipelines[0];
      if (defaultPipe) {
        setSelectedPipelineId(defaultPipe.id);
        setSelectedStatus(defaultPipe.stages[0]?.id || '');
      }

      setStep(2);
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      if (fileInputRef.current) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInputRef.current.files = dataTransfer.files;
        // Trigger manual change handler
        const event = { target: fileInputRef.current } as unknown as React.ChangeEvent<HTMLInputElement>;
        handleFileChange(event);
      }
    } else {
      alert("Please upload a valid .csv file.");
    }
  };

  // Maps row to lead payload structure
  const getMappedLead = (row: string[]): Partial<Lead> & { name: string; phone: string } => {
    const lead: any = {};
    MAPPABLE_FIELDS.forEach(field => {
      const colIdxStr = mapping[field.key];
      if (colIdxStr !== '') {
        const colIdx = parseInt(colIdxStr);
        const val = row[colIdx];
        if (val !== undefined && val !== null) {
          if (field.type === 'number') {
            const numVal = parseFloat(val.replace(/[^0-9.]/g, ''));
            lead[field.key] = isNaN(numVal) ? undefined : numVal;
          } else if (field.type === 'tags') {
            lead[field.key] = val.split(',').map(t => t.trim()).filter(Boolean);
          } else {
            lead[field.key] = val;
          }
        }
      }
    });

    // Enforce fallbacks
    if (!lead.lead_source) lead.lead_source = 'CSV Import';
    if (selectedPipelineId) lead.pipeline_id = selectedPipelineId;
    if (selectedStatus) lead.status = selectedStatus;
    if (importAssignmentMode === 'individual' && importSelectedCounsellorId) {
      lead.assigned_counsellor_id = importSelectedCounsellorId;
    }

    return lead;
  };

  // Validates a single row mapping
  const validateRow = (row: string[]) => {
    const lead = getMappedLead(row);
    const hasName = !!lead.name && lead.name.trim().length > 0;
    const hasPhone = !!lead.phone && lead.phone.trim().length > 0;
    return {
      isValid: hasName && hasPhone,
      missingName: !hasName,
      missingPhone: !hasPhone
    };
  };

  // Generate mapping preview rows
  const previewMappedLeads = csvRows.slice(0, 10).map(row => {
    const lead = getMappedLead(row);
    const validation = validateRow(row);
    return { lead, validation, original: row };
  });

  const handleImportSubmit = async () => {
    setIsSubmitting(true);
    try {
      const validLeadsToInsert: Omit<Lead, 'id' | 'created_at' | 'updated_at'>[] = [];
      const leadsToUpdate: { id: string; updates: Partial<Lead> }[] = [];
      let skippedCount = 0;
      let updatedCount = 0;

      // Build target candidates list if in split mode
      const eligibleCounselors = new Set<string>();
      if (importAssignmentMode === 'split') {
        importSplitTargets.forEach(tId => {
          const isTeam = teams.some(t => t.id === tId);
          if (isTeam) {
            teamMembers.filter(tm => tm.team_id === tId).forEach(tm => eligibleCounselors.add(tm.profile_id));
          } else {
            eligibleCounselors.add(tId);
          }
        });
      }
      const candidates = Array.from(eligibleCounselors);
      let candidateIndex = 0;

      csvRows.forEach(row => {
        const lead = getMappedLead(row);
        const validation = validateRow(row);

        if (!validation.isValid) {
          skippedCount++;
          return;
        }

        // Apply split round robin logic if applicable
        if (importAssignmentMode === 'split' && candidates.length > 0) {
          const assignedCounsellorId = candidates[candidateIndex % candidates.length];
          lead.assigned_counsellor_id = assignedCounsellorId;
          
          const memberTeam = teamMembers.find(tm => tm.profile_id === assignedCounsellorId && importSplitTargets.includes(tm.team_id));
          if (memberTeam) {
            lead.assigned_team_id = memberTeam.team_id;
          }
          candidateIndex++;
        }

        // Check duplicates
        const existingLead = leads.find(l => l.phone === lead.phone);
        if (existingLead) {
          if (duplicateStrategy === 'update') {
            leadsToUpdate.push({
              id: existingLead.id,
              updates: {
                ...lead,
                // keep tags merged
                tags: Array.from(new Set([...(existingLead.tags || []), ...(lead.tags || [])]))
              }
            });
          } else {
            skippedCount++;
          }
        } else {
          validLeadsToInsert.push(lead as Omit<Lead, 'id' | 'created_at' | 'updated_at'>);
        }
      });

      // 1. Process inserts in bulk
      let insertedCount = 0;
      if (validLeadsToInsert.length > 0) {
        const insertedList = await bulkAddLeads(validLeadsToInsert);
        insertedCount = insertedList.length;
      }

      // 2. Process updates sequentially or concurrently
      if (leadsToUpdate.length > 0) {
        await Promise.all(
          leadsToUpdate.map(async item => {
            await updateLead(item.id, item.updates);
            updatedCount++;
          })
        );
      }

      setImportResult({
        imported: insertedCount,
        updated: updatedCount,
        skipped: skippedCount
      });
      setStep(4);
    } catch (err) {
      console.error(err);
      alert("An error occurred during import. Please verify mapping formats.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId);
  const statusOptions = selectedPipeline ? selectedPipeline.stages : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl bg-slate-900/95 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold">Import Leads from CSV</h3>
            <p className="text-xs text-slate-400 mt-0.5">Step {step} of 4: {
              step === 1 ? 'Upload File' : 
              step === 2 ? 'Map Table Columns' : 
              step === 3 ? 'Preview & Import Settings' : 'Import Complete'
            }</p>
          </div>
          {step !== 3 && (
            <button 
              onClick={onClose}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>

        {/* Steps Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* STEP 1: Upload */}
          {step === 1 && (
            <div className="flex flex-col items-center justify-center py-10">
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="w-full max-w-lg border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-900/40 rounded-2xl p-10 flex flex-col items-center text-center cursor-pointer transition-all gap-4"
              >
                <div className="p-4 bg-indigo-500/10 rounded-full border border-indigo-500/20">
                  <Upload className="w-8 h-8 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Click to upload or drag & drop</p>
                  <p className="text-xs text-slate-500 mt-1">CSV files only (max. 10MB)</p>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".csv" 
                  className="hidden" 
                />
              </div>

              <div className="mt-8 max-w-lg bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 flex gap-3 text-xs text-slate-400">
                <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-200">CSV Template Guidance</p>
                  <p className="mt-1 leading-relaxed">
                    Make sure your CSV contains columns for <strong>Student Name</strong> and <strong>Phone Number</strong>. Other fields such as Email, NEET Marks, Budget, Preferred Destination, and Course are optional but will be automatically imported if mapped.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Map Columns */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="p-4 bg-indigo-950/20 border border-indigo-900/40 rounded-2xl text-xs text-indigo-300">
                Match each CRM Lead target field to its corresponding column header from your uploaded file (<strong>{csvFileName}</strong>). We have auto-detected matches where possible.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MAPPABLE_FIELDS.map(field => {
                  const currentMappedVal = mapping[field.key] || '';
                  return (
                    <div 
                      key={field.key} 
                      className={`p-4 rounded-2xl border ${
                        field.required 
                          ? currentMappedVal === '' 
                            ? 'border-rose-500/30 bg-rose-500/[0.02]' 
                            : 'border-slate-800 bg-slate-950/20' 
                          : 'border-slate-800 bg-slate-950/10'
                      } flex items-center justify-between gap-4`}
                    >
                      <div>
                        <span className="text-xs font-semibold block">
                          {field.label}
                        </span>
                        {field.required && currentMappedVal === '' && (
                          <span className="text-[10px] text-rose-400 font-bold uppercase mt-0.5 block">Required Mapping</span>
                        )}
                      </div>
                      
                      <select
                        value={currentMappedVal}
                        onChange={(e) => {
                          setMapping(prev => ({ ...prev, [field.key]: e.target.value }));
                        }}
                        className="bg-slate-900 border border-slate-700 text-xs rounded-xl p-2.5 outline-none text-slate-200 max-w-[200px]"
                      >
                        <option value="">-- Unmapped --</option>
                        {headers.map((h, index) => (
                          <option key={index} value={index.toString()}>
                            Column {index + 1}: {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                <button
                  onClick={() => setStep(1)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={MAPPABLE_FIELDS.some(f => f.required && (!mapping[f.key] || mapping[f.key] === ''))}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
                >
                  Configure & Preview <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Preview & Settings */}
          {step === 3 && (
            <div className="space-y-6">
              
              {/* Import Options / Settings grid */}
              <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 text-xs">
                
                {/* Duplicate logic */}
                <div>
                  <label className="block text-slate-400 font-bold mb-2 uppercase tracking-wide">Duplicate Handling</label>
                  <div className="space-y-2 mt-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="duplicateStrategy" 
                        value="update"
                        checked={duplicateStrategy === 'update'}
                        onChange={() => setDuplicateStrategy('update')}
                        className="text-indigo-600 focus:ring-0" 
                      />
                      <span>Merge/Update existing</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="duplicateStrategy" 
                        value="skip"
                        checked={duplicateStrategy === 'skip'}
                        onChange={() => setDuplicateStrategy('skip')}
                        className="text-indigo-600 focus:ring-0" 
                      />
                      <span>Skip duplicates</span>
                    </label>
                  </div>
                </div>

                {/* Target Pipeline */}
                <div>
                  <label className="block text-slate-400 font-bold mb-2 uppercase tracking-wide">Target Pipeline</label>
                  <select
                    value={selectedPipelineId}
                    onChange={(e) => {
                      const pipeId = e.target.value;
                      setSelectedPipelineId(pipeId);
                      const p = pipelines.find(pl => pl.id === pipeId);
                      setSelectedStatus(p?.stages[0]?.id || '');
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 outline-none"
                  >
                    {pipelines.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Target Stage */}
                <div>
                  <label className="block text-slate-400 font-bold mb-2 uppercase tracking-wide">Initial Status Stage</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 outline-none"
                  >
                    {statusOptions.map(st => (
                      <option key={st.id} value={st.id}>{st.name}</option>
                    ))}
                  </select>
                </div>

                {/* Default Assignee Mode */}
                <div>
                  <label className="block text-slate-400 font-bold mb-2 uppercase tracking-wide">Assignment Type</label>
                  <select
                    value={importAssignmentMode}
                    onChange={(e) => {
                      const mode = e.target.value as any;
                      setImportAssignmentMode(mode);
                      setImportSelectedCounsellorId('');
                      setImportSplitTargets([]);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 outline-none"
                  >
                    <option value="unassigned">Unassigned</option>
                    <option value="individual">Individual Counselor</option>
                    <option value="split">Split Auto-Assign (Round-Robin)</option>
                  </select>
                </div>
              </div>

              {/* Assignment Target Selectors based on mode */}
              {importAssignmentMode === 'individual' && (
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-5 text-xs animate-slide-down">
                  <label className="block text-slate-400 font-bold mb-2 uppercase tracking-wide">Select Target Counselor / Manager</label>
                  <select
                    value={importSelectedCounsellorId}
                    onChange={(e) => setImportSelectedCounsellorId(e.target.value)}
                    className="w-full md:w-1/2 bg-slate-900 border border-slate-700 rounded-xl p-2 outline-none"
                  >
                    <option value="">Choose counselor...</option>
                    {profiles.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>
                    ))}
                  </select>
                </div>
              )}

              {importAssignmentMode === 'split' && (
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-5 text-xs space-y-3 animate-slide-down">
                  <label className="block text-slate-400 font-bold uppercase tracking-wide">Select Split Targets (Imported leads will be divided equally round-robin)</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Teams / Groups Available</span>
                      {teams.length === 0 ? (
                        <p className="text-[10px] text-slate-400 italic">No teams configured. Configure teams in CRM Settings.</p>
                      ) : teams.map(t => (
                        <label key={t.id} className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={importSplitTargets.includes(t.id)}
                            onChange={(e) => {
                              if (e.target.checked) setImportSplitTargets(prev => [...prev, t.id]);
                              else setImportSplitTargets(prev => prev.filter(id => id !== t.id));
                            }}
                            className="rounded text-indigo-650 focus:ring-0 border-slate-700 w-3.5 h-3.5"
                          />
                          <span>{t.name} (Team)</span>
                        </label>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Individual Counselors / Managers</span>
                      {profiles.map(p => (
                        <label key={p.id} className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={importSplitTargets.includes(p.id)}
                            onChange={(e) => {
                              if (e.target.checked) setImportSplitTargets(prev => [...prev, p.id]);
                              else setImportSplitTargets(prev => prev.filter(id => id !== p.id));
                            }}
                            className="rounded text-indigo-650 focus:ring-0 border-slate-700 w-3.5 h-3.5"
                          />
                          <span>{p.full_name} ({p.role})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Preview table */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  Mapped Preview (Showing first 10 rows)
                </h4>
                <div className="border border-slate-800 rounded-2xl overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold">
                        <th className="px-4 py-3">Valid?</th>
                        <th className="px-4 py-3">Student Name</th>
                        <th className="px-4 py-3">Phone</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Destination</th>
                        <th className="px-4 py-3">Course</th>
                        <th className="px-4 py-3">NEET Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {previewMappedLeads.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-950/25">
                          <td className="px-4 py-3">
                            {item.validation.isValid ? (
                              <div className="p-1 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-lg w-fit">
                                <Check className="w-3.5 h-3.5" />
                              </div>
                            ) : (
                              <div 
                                className="p-1 bg-rose-500/10 border border-rose-500/25 text-rose-400 rounded-lg w-fit cursor-help"
                                title={
                                  item.validation.missingName && item.validation.missingPhone 
                                    ? "Missing student name & phone number" 
                                    : item.validation.missingName 
                                      ? "Missing student name" 
                                      : "Missing phone number"
                                }
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-200">
                            {item.lead.name || <span className="text-rose-400 font-bold">&lt;Missing&gt;</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-350">
                            {item.lead.phone || <span className="text-rose-400 font-bold">&lt;Missing&gt;</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-400">{item.lead.email || '--'}</td>
                          <td className="px-4 py-3 text-slate-400">{item.lead.preferred_destination || '--'}</td>
                          <td className="px-4 py-3 text-slate-400">{item.lead.course || '--'}</td>
                          <td className="px-4 py-3 text-slate-400">{item.lead.neet_marks || '--'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                <button
                  onClick={() => setStep(2)}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleImportSubmit}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-emerald-500/10"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Importing leads...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> Start Bulk Import ({csvRows.length} rows)
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Import Complete */}
          {step === 4 && importResult && (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-4 animate-fade-in">
              <div className="p-4 bg-emerald-500/10 rounded-full border border-emerald-500/20 text-emerald-400">
                <Check className="w-12 h-12" />
              </div>
              
              <div>
                <h4 className="text-xl font-bold">Import Completed successfully!</h4>
                <p className="text-xs text-slate-400 mt-1">Your lead file has been processed.</p>
              </div>

              <div className="w-full max-w-sm bg-slate-950/40 border border-slate-800 rounded-2xl p-5 text-sm grid grid-cols-3 divide-x divide-slate-800 text-center my-4">
                <div>
                  <span className="block text-slate-500 text-[10px] font-bold uppercase tracking-wide">Created</span>
                  <span className="block text-lg font-bold text-emerald-400 mt-1">{importResult.imported}</span>
                </div>
                <div>
                  <span className="block text-slate-500 text-[10px] font-bold uppercase tracking-wide">Updated</span>
                  <span className="block text-lg font-bold text-indigo-400 mt-1">{importResult.updated}</span>
                </div>
                <div>
                  <span className="block text-slate-500 text-[10px] font-bold uppercase tracking-wide">Skipped</span>
                  <span className="block text-lg font-bold text-slate-400 mt-1">{importResult.skipped}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  onClose();
                  // Reset modal states
                  setStep(1);
                  setCsvFileName('');
                  setHeaders([]);
                  setCsvRows([]);
                  setMapping({});
                  setImportResult(null);
                }}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold shadow-lg shadow-indigo-500/15 transition-all hover:scale-[1.01]"
              >
                Close & Refresh List
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
