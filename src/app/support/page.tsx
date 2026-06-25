"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Mail, Phone, MapPin, Send, HelpCircle, CheckCircle2, MessageSquare, AlertCircle } from 'lucide-react';

export default function SupportPage() {
  const lastUpdated = "June 26, 2026";
  const contactEmail = "crm@perfectscholar.com";

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [ticketId, setTicketId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !subject || !message) {
      setError('Please fill in all the required fields.');
      return;
    }
    
    setError('');
    setIsLoading(true);

    // Simulate API request to support ticket endpoint
    setTimeout(() => {
      setIsLoading(false);
      setSuccess(true);
      // Generate a random ticket ID
      const randomId = 'PS-' + Math.floor(100000 + Math.random() * 900000);
      setTicketId(randomId);
    }, 1200);
  };

  const resetForm = () => {
    setName('');
    setEmail('');
    setSubject('');
    setMessage('');
    setSuccess(false);
    setError('');
    setTicketId('');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-800 dark:text-zinc-100 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300 font-sans relative">
      
      {/* Background Graphic Accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/5 dark:bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-indigo-600/5 dark:bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-10">
        
        {/* Navigation / Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 transition-colors uppercase tracking-wider"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Workspace
          </Link>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-extrabold uppercase tracking-widest">
            <HelpCircle className="w-3.5 h-3.5" /> Support & Assistance
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white/80 dark:bg-zinc-950/60 backdrop-blur-xl border border-slate-200/80 dark:border-zinc-900/80 rounded-3xl p-8 sm:p-12 shadow-xl dark:shadow-2xl">
          
          {/* Main Title Section */}
          <div className="border-b border-slate-100 dark:border-zinc-900 pb-8 mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-white dark:via-zinc-200 dark:to-white mb-2">
              Customer Support Center
            </h1>
            <p className="text-xs text-slate-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">
              Perfect Scholar Lead Management System • Last Updated: {lastUpdated}
            </p>
          </div>

          {/* Intro description */}
          <div className="mb-10 text-sm text-slate-650 dark:text-zinc-400 leading-relaxed">
            Welcome to the Perfect Scholar CRM Support Center. Whether you are an educational consultant managing study-abroad prospects, an administrative coordinator, or a prospective student checking on application progress, our support team is ready to assist you.
          </div>

          {/* Quick Channels Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="p-5 rounded-2xl bg-slate-100/50 dark:bg-zinc-900/30 border border-slate-200/20 dark:border-zinc-800/30 flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-1">Email Support</h4>
                <a href={`mailto:${contactEmail}`} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline break-all font-semibold">
                  {contactEmail}
                </a>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">Average response within 24 hours.</p>
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-100/50 dark:bg-zinc-900/30 border border-slate-200/20 dark:border-zinc-800/30 flex items-start gap-3">
              <Phone className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-1">Partner Hotlines</h4>
                <p className="text-xs text-slate-650 dark:text-zinc-400 font-semibold">+91 8807134560</p>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">Mon - Fri • 9:00 AM - 6:00 PM IST</p>
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-100/50 dark:bg-zinc-900/30 border border-slate-200/20 dark:border-zinc-800/30 flex items-start gap-3">
              <MapPin className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-1">HQ Locations</h4>
                <p className="text-xs text-slate-650 dark:text-zinc-400 leading-relaxed">Perfect Scholar Offices, Higher Education Hub, India</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Form Section */}
            <div className="lg:col-span-7 space-y-6">
              <div className="p-6 sm:p-8 rounded-3xl bg-slate-100/30 dark:bg-zinc-900/20 border border-slate-200/40 dark:border-zinc-900/60 shadow-inner">
                
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6 border-b border-slate-150 dark:border-zinc-900/80 pb-3">
                  <MessageSquare className="w-4 h-4 text-indigo-500" /> Submit a Support Ticket
                </h3>

                {success ? (
                  <div className="text-center py-6 space-y-4 animate-fade-in">
                    <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-500">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">Ticket Submitted Successfully!</h4>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Your query has been recorded in our helpdesk database.</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-900 rounded-xl p-3 inline-block">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase block">Ticket ID</span>
                      <span className="text-sm font-mono font-extrabold text-indigo-600 dark:text-indigo-400">{ticketId}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500">Our customer success representative will follow up at <strong className="text-slate-800 dark:text-zinc-350">{email}</strong> within 12-24 hours.</p>
                    <button
                      onClick={resetForm}
                      className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                    >
                      Submit Another Ticket
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    
                    {error && (
                      <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500 text-xs flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4" />
                        <span>{error}</span>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5">
                        Your Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Sarah Jenkins"
                        className="w-full bg-white dark:bg-zinc-950/80 border border-slate-200/80 dark:border-zinc-900 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs outline-none text-slate-800 dark:text-white transition-all shadow-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5">
                        Email Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. sarah@example.com"
                        className="w-full bg-white dark:bg-zinc-950/80 border border-slate-200/80 dark:border-zinc-900 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs outline-none text-slate-800 dark:text-white transition-all shadow-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5">
                        Subject / Issue Area <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="e.g. Account restoration or Visa file query"
                        className="w-full bg-white dark:bg-zinc-950/80 border border-slate-200/80 dark:border-zinc-900 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs outline-none text-slate-800 dark:text-white transition-all shadow-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest mb-1.5">
                        Message Details <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Describe your issue or question in detail..."
                        className="w-full bg-white dark:bg-zinc-950/80 border border-slate-200/80 dark:border-zinc-900 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs outline-none text-slate-800 dark:text-white transition-all shadow-sm resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-650/10 hover:scale-[1.01] transition-all disabled:opacity-50"
                    >
                      {isLoading ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      <span>Submit Help Ticket</span>
                    </button>
                  </form>
                )}

              </div>
            </div>

            {/* FAQs Section */}
            <div className="lg:col-span-5 space-y-6">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-zinc-900 pb-2">
                Frequently Asked Questions
              </h3>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-850 dark:text-zinc-200">How do I access my consultant account?</h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                    Consultant credentials are set up and distributed directly by your local workspace system administrator. If you forgot your password, utilize the "Forgot Password" OTP flow on the login card.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-850 dark:text-zinc-200">How do student candidates register?</h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                    Students do not register directly on the CRM platform. Instead, student information is securely recorded by authorized consultants during study-abroad planning or imported via public web forms generated on the dashboard.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-slate-850 dark:text-zinc-200">How can I request deletion of my data?</h4>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                    We support full GDPR/CCPA data rights. If you are an active counselor or a registered candidate, you can request permanent data erasure at any time via our dedicated <Link href="/data-deletion" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">Data Deletion Instructions</Link> page.
                  </p>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Legal Footer Note */}
        <div className="mt-8 text-center text-xs text-slate-400 dark:text-zinc-650">
          Perfect Scholar © {new Date().getFullYear()} • Confidential System Documentation
        </div>

      </div>
    </div>
  );
}
