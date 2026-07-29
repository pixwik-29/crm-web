'use client';

import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Upload, Trash2, FileText, Sparkles, RefreshCw, CheckCircle2, Shield, AlertCircle, Search, Layers } from 'lucide-react';

interface CustomKnowledgeItem {
  id: string;
  title: string;
  category: string;
  content: string;
  created_at: string;
  file_name?: string;
}

export function AIKnowledgeManager({ tenantId = 'nash-pixwik-admin' }: { tenantId?: string }) {
  const [items, setItems] = useState<CustomKnowledgeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  
  // Add modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: 'All Knowledge' },
    { id: 'visa', label: 'Visa & Immigration' },
    { id: 'scholarship', label: 'Scholarships & Loans' },
    { id: 'documents', label: 'Document Checklists' },
    { id: 'faq', label: 'General FAQs' },
    { id: 'general', label: 'General Info' }
  ];

  const fetchKnowledgeItems = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/ai-knowledge');
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
      }
    } catch (err) {
      console.error('Failed to load knowledge items:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKnowledgeItems();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
        setContent(text);
        setToastMsg(`Uploaded file "${file.name}" loaded into form.`);
        setTimeout(() => setToastMsg(null), 4000);
      }
    };
    reader.readAsText(file);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/ai-knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          category,
          content,
          tenantId
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save knowledge item');

      setToastMsg('✨ Knowledge item saved and synced to AI Chatbot!');
      setTimeout(() => setToastMsg(null), 4000);

      // Reset form
      setTitle('');
      setContent('');
      setCategory('general');
      setIsAddOpen(false);

      fetchKnowledgeItems();
    } catch (err: any) {
      alert(err.message || 'Error saving knowledge item');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this knowledge item? The AI will no longer answer using this item.')) return;

    try {
      const res = await fetch(`/api/ai-knowledge?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete item');

      setItems(prev => prev.filter(i => i.id !== id));
      setToastMsg('Knowledge item deleted.');
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to delete');
    }
  };

  const filteredItems = items.filter(item => {
    const matchesCat = filterCategory === 'all' || item.category === filterCategory;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="p-3 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-lg flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{toastMsg}</span>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-6 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-indigo-500/20">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            <h2 className="text-xl font-black tracking-tight">AI Knowledge Base Manager</h2>
          </div>
          <p className="text-xs text-indigo-200 font-medium max-w-xl">
            Upload custom guidelines, FAQs, visa policies, and scholarship notes. The AI Assistant on Web & WhatsApp automatically learns and answers from all active knowledge items!
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchKnowledgeItems}
            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all border border-white/10 flex items-center gap-2 text-xs font-extrabold cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setIsAddOpen(true)}
            className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl shadow-lg transition-all flex items-center gap-2 text-xs font-extrabold cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add Knowledge Item
          </button>
        </div>
      </div>

      {/* Category Pills & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer ${
                filterCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search knowledge..."
            className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl pl-9 pr-3.5 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-zinc-100"
          />
        </div>
      </div>

      {/* Knowledge Base Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 font-medium text-xs">
          Loading AI Knowledge items...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-slate-200 dark:border-zinc-800">
          <BookOpen className="w-10 h-10 text-slate-300 dark:text-zinc-700 mx-auto mb-3" />
          <p className="text-sm font-extrabold text-slate-700 dark:text-zinc-200">No Knowledge Base Items Found</p>
          <p className="text-xs text-slate-400 mt-1">Click "Add Knowledge Item" to upload FAQs or guidelines.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map(item => (
            <div
              key={item.id}
              className="p-5 bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-black text-[10px] uppercase tracking-wider">
                    {item.category}
                  </span>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all cursor-pointer"
                    title="Delete item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="font-extrabold text-sm text-slate-800 dark:text-zinc-100 mb-2">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-medium line-clamp-4 whitespace-pre-wrap">
                  {item.content}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                <span>Added: {new Date(item.created_at).toLocaleDateString()}</span>
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                  <CheckCircle2 className="w-3 h-3" /> Active in RAG
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Upload Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-300" />
                <h3 className="font-extrabold text-sm">Add AI Knowledge Entry</h3>
              </div>
              <button
                onClick={() => setIsAddOpen(false)}
                className="p-1 hover:bg-white/10 rounded-full text-white/80"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-6 space-y-4">
              {/* File Upload Box */}
              <div className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700 text-center">
                <Upload className="w-6 h-6 text-indigo-500 mx-auto mb-1.5" />
                <p className="text-xs font-bold text-slate-700 dark:text-zinc-200">Upload Text / Markdown File (.txt, .md)</p>
                <p className="text-[10px] text-slate-400 mb-2">Or type manually in the form below</p>
                <input
                  type="file"
                  accept=".txt,.md"
                  onChange={handleFileUpload}
                  className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Knowledge Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Visa Process Checklist for Georgia"
                  className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="general">General Info</option>
                  <option value="visa">Visa & Immigration</option>
                  <option value="scholarship">Scholarships & Education Loans</option>
                  <option value="documents">Document Checklists</option>
                  <option value="faq">General FAQ</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Content / Q&A Knowledge Text *</label>
                <textarea
                  required
                  rows={6}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Type or paste the detailed knowledge information, guidelines, or Q&A pairs here..."
                  className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 text-xs font-medium text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Knowledge Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
