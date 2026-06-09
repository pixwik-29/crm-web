"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, Info, Check, Plus, Trash2, ArrowRight } from 'lucide-react';

interface MockPage {
  id: string;
  name: string;
  access_token: string;
  selected: boolean;
}

function FacebookOAuthMockContent() {
  const searchParams = useSearchParams();
  const state = searchParams.get('state') || '';
  const redirectUri = searchParams.get('redirect_uri') || '/api/fb-oauth/callback';

  // Resolve tenant ID from state base64url
  const [tenantId, setTenantId] = useState('default');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Login/Permissions, 2: Select Pages, 3: Connecting Animation

  useEffect(() => {
    if (state) {
      try {
        // Decode base64url
        const base64 = state.replace(/-/g, '+').replace(/_/g, '/');
        const decoded = atob(base64);
        const resolved = decoded.split('|')[0] || 'default';
        setTenantId(resolved);
      } catch (err) {
        console.error('Failed to decode state:', err);
      }
    }
  }, [state]);

  // Dynamic pages based on resolved tenantId
  const [pages, setPages] = useState<MockPage[]>([]);
  const [customPageName, setCustomPageName] = useState('');

  // Seed default pages once tenantId is resolved
  useEffect(() => {
    const formattedTenant = tenantId.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    setPages([
      { id: `mock-page-id-${tenantId}-1`, name: `${formattedTenant} Official Page`, access_token: `mock_page_token_1_${Date.now()}`, selected: true },
      { id: `mock-page-id-${tenantId}-2`, name: `${formattedTenant} MBBS Admissions`, access_token: `mock_page_token_2_${Date.now()}`, selected: true },
      { id: `mock-page-id-${tenantId}-3`, name: `${formattedTenant} Leads & Ads Sync`, access_token: `mock_page_token_3_${Date.now()}`, selected: false }
    ]);
  }, [tenantId]);

  const handleAddCustomPage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPageName.trim()) return;
    const newPage: MockPage = {
      id: `mock-page-custom-${Date.now()}`,
      name: customPageName.trim(),
      access_token: `mock_custom_token_${Date.now()}`,
      selected: true
    };
    setPages([...pages, newPage]);
    setCustomPageName('');
  };

  const togglePageSelection = (id: string) => {
    setPages(pages.map(p => p.id === id ? { ...p, selected: !p.selected } : p));
  };

  const handleDeletePage = (id: string) => {
    setPages(pages.filter(p => p.id !== id));
  };

  const handleAuthorize = () => {
    setStep(3);
    setLoading(true);

    const selectedPages = pages
      .filter(p => p.selected)
      .map(p => ({ id: p.id, name: p.name, access_token: p.access_token }));

    setTimeout(() => {
      // Build callback URL
      const callbackUrl = new URL(redirectUri, window.location.origin);
      callbackUrl.searchParams.set('code', `mock_code_${tenantId}_${Date.now()}`);
      callbackUrl.searchParams.set('state', state);
      callbackUrl.searchParams.set('pages', JSON.stringify(selectedPages));
      
      window.location.href = callbackUrl.toString();
    }, 2000);
  };

  const formattedTenantName = tenantId.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between items-center p-6 relative overflow-hidden font-sans">
      {/* Background subtle graphics */}
      <div className="absolute top-[-25%] left-[-25%] w-[70%] h-[70%] bg-blue-600/10 rounded-full blur-[150px]"></div>
      <div className="absolute bottom-[-25%] right-[-25%] w-[70%] h-[70%] bg-indigo-600/10 rounded-full blur-[150px]"></div>

      {/* Header bar resembling Facebook's top bar */}
      <header className="w-full max-w-lg flex items-center justify-between py-4 z-10 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#1877F2] flex items-center justify-center font-extrabold text-white text-lg">
            f
          </div>
          <span className="text-sm font-semibold tracking-wide text-slate-350">Facebook for Developers</span>
        </div>
        <span className="text-xs text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
          Sandbox Mode
        </span>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-md bg-slate-950/65 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 my-8 flex flex-col justify-center">
        
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#1877F2]/10 border border-[#1877F2]/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg viewBox="0 0 24 24" fill="#1877F2" className="w-8 h-8">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>
              <h2 className="text-lg font-bold">Facebook Login Simulation</h2>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Connect your workspace <strong className="text-white">"{formattedTenantName}"</strong> to Facebook Ads Lead Retrieval.
              </p>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4.5 h-4.5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Permissions Requested</h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">
                    This will grant Perfect Scholar CRM read access to your Facebook Lead Forms and Ads accounts.
                  </p>
                </div>
              </div>

              <ul className="text-[10px] font-semibold text-slate-350 space-y-1.5 pl-7 list-disc">
                <li>Show list of pages you manage</li>
                <li>Retrieve lead ads data and submissions</li>
                <li>Manage WhatsApp messaging connections</li>
              </ul>
            </div>

            <div className="p-3.5 bg-blue-500/5 border border-blue-500/20 text-blue-400 text-[10px] leading-relaxed rounded-xl flex gap-2">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                To connect to production, use the manual access token input on the settings page to paste your official system user token.
              </span>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full bg-[#1877F2] hover:bg-[#166fe5] active:scale-[0.99] transition-all text-white font-bold py-3 rounded-xl shadow-md shadow-blue-500/10 flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider"
            >
              Continue as {formattedTenantName} <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Select Facebook Pages</h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Choose the page(s) you wish to authorize for lead ingestion.
              </p>
            </div>

            {/* List of Pages */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {pages.map(p => (
                <div 
                  key={p.id}
                  onClick={() => togglePageSelection(p.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    p.selected 
                      ? 'bg-blue-600/10 border-blue-500/40 text-white' 
                      : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                      p.selected ? 'bg-blue-600 border-transparent text-white' : 'border-slate-600 text-transparent'
                    }`}>
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">{p.name}</p>
                      <p className="text-[9px] text-slate-500 mt-0.5">ID: {p.id}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDeletePage(p.id); }}
                    className="p-1 hover:bg-rose-500/10 rounded-lg text-slate-500 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Custom Page Input Form */}
            <form onSubmit={handleAddCustomPage} className="flex gap-2">
              <input
                type="text"
                value={customPageName}
                onChange={(e) => setCustomPageName(e.target.value)}
                placeholder="Enter custom Page name..."
                className="flex-1 bg-slate-900/80 border border-slate-800 focus:border-blue-500 rounded-xl p-2.5 text-xs outline-none text-white transition-all"
              />
              <button
                type="submit"
                className="px-3.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs flex items-center justify-center text-slate-300 font-bold transition-all border border-slate-755"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-400 font-bold py-3 rounded-xl border border-slate-800 transition-all text-xs text-center"
              >
                Back
              </button>
              <button
                onClick={handleAuthorize}
                disabled={!pages.some(p => p.selected)}
                className="flex-2 bg-[#1877F2] hover:bg-[#166fe5] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl shadow-md transition-all text-xs tracking-wide uppercase"
              >
                Authorize & Link
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col items-center py-12 space-y-6">
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border-4 border-slate-800 border-t-[#1877F2] animate-spin"></div>
              <div className="absolute w-8 h-8 rounded-lg bg-[#1877F2] flex items-center justify-center font-bold text-white text-sm">
                f
              </div>
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-slate-200">Connecting Page Accounts...</h3>
              <p className="text-[10px] text-slate-500">Syncing security credentials with {formattedTenantName} CRM</p>
            </div>
          </div>
        )}

      </main>

      {/* Footer bar */}
      <footer className="w-full max-w-lg text-center py-4 border-t border-slate-850 z-10 text-[9px] text-slate-500 font-semibold uppercase tracking-wider">
        Meta Developer Sandbox Tooling • Perfect Scholar Multi-Tenant Security System
      </footer>
    </div>
  );
}

export default function FacebookOAuthMockPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
        <div className="w-10 h-10 rounded-full border-4 border-slate-800 border-t-[#1877F2] animate-spin mb-4"></div>
        <p className="text-xs text-slate-400">Loading Simulated Facebook Environment...</p>
      </div>
    }>
      <FacebookOAuthMockContent />
    </Suspense>
  );
}
