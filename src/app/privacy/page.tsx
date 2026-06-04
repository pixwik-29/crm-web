import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Database, Lock, Eye, Mail } from 'lucide-react';

export default function PrivacyPolicyPage() {
  const lastUpdated = "June 4, 2026";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-800 dark:text-zinc-100 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300 font-sans">
      
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
            <ShieldCheck className="w-3.5 h-3.5" /> Legal & Compliance
          </div>
        </div>

        {/* Content Card */}
        <div className="bg-white/80 dark:bg-zinc-950/60 backdrop-blur-xl border border-slate-200/80 dark:border-zinc-900/80 rounded-3xl p-8 sm:p-12 shadow-xl dark:shadow-2xl">
          
          {/* Main Title Section */}
          <div className="border-b border-slate-100 dark:border-zinc-900 pb-8 mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-white dark:via-zinc-200 dark:to-white mb-2">
              Privacy Policy
            </h1>
            <p className="text-xs text-slate-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">
              Perfect Scholar Lead Management System • Last Updated: {lastUpdated}
            </p>
          </div>

          {/* Quick Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="p-5 rounded-2xl bg-slate-100/50 dark:bg-zinc-900/30 border border-slate-200/20 dark:border-zinc-800/30 flex items-start gap-3">
              <Database className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-1">Data Storage</h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">Secure, encrypted cloud storage powered by Supabase with granular row-level access control.</p>
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-100/50 dark:bg-zinc-900/30 border border-slate-200/20 dark:border-zinc-800/30 flex items-start gap-3">
              <Eye className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-1">Zero Sharing</h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">Candidate and team data is strictly utilized for Perfect Scholar's business purposes; never sold or shared.</p>
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-100/50 dark:bg-zinc-900/30 border border-slate-200/20 dark:border-zinc-800/30 flex items-start gap-3">
              <Lock className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-1">Security First</h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">Full transport security via SSL/TLS encryption. Secure account creation for authorised personnel only.</p>
              </div>
            </div>
          </div>

          {/* Detailed Policy Text */}
          <div className="space-y-8 text-sm leading-relaxed text-slate-650 dark:text-zinc-350">
            
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                1. Introduction
              </h2>
              <p>
                Welcome to <strong>Perfect Scholar CRM</strong> ("we," "our," "us"). We are committed to protecting the personal data of our users (educational consultants, counsellors, administrators) and the prospective students ("Leads" or "Candidates") whose profiles are managed inside our CRM ecosystem.
              </p>
              <p>
                This Privacy Policy explains how we collect, store, use, and protect information when you utilize the Perfect Scholar CRM web application and our companion native mobile applications distributed via the Apple App Store and Google Play Store.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                2. Information We Collect
              </h2>
              <p>
                To provide our lead management and visa-processing services, we collect several categories of information:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Account Credentials:</strong> Name, professional email address, mobile phone number, administrative role, and cryptographically hashed passwords when you register as a counsellor or manager.
                </li>
                <li>
                  <strong>Candidate/Student Lead Profiles:</strong> Student names, contact details, academic interests, country preferences, current processing stages, and internal progress files uploaded by assigned counsellors.
                </li>
                <li>
                  <strong>Communication Records:</strong> Text notes, scheduled follow-up tasks, and logs of communication templates (WhatsApp campaigns/SMS logs) utilized to interact with prospective students.
                </li>
                <li>
                  <strong>System & Device Tokens:</strong> Expo Push Tokens or Exponent Push Tokens dynamically generated by the user's mobile device to enable real-time notifications for newly assigned leads and upcoming tasks.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                3. How We Use Your Information
              </h2>
              <p>
                We use the collected information for the following specific purposes:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>To authenticate system users and assign role-based database access permissions (Admin, Manager, Counsellor).</li>
                <li>To allocate prospective student leads to specific counsellors for study-abroad counseling and visa application tracking.</li>
                <li>To schedule and deliver push notification reminders for pending tasks, customer callback schedules, and lead status updates.</li>
                <li>To optimize and analyze lead capture sources (e.g., website forms, social media campaigns) and counselor performance analytics.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                4. Third-Party Services & Subprocessors
              </h2>
              <p>
                We do not sell or trade your personal data. We utilize trusted cloud subprocessors strictly to host infrastructure and deliver notifications:
              </p>
              <div className="bg-slate-50 dark:bg-zinc-900/40 border border-slate-200/50 dark:border-zinc-800/40 rounded-2xl p-4 space-y-3 text-xs">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-bold text-slate-800 dark:text-white">Supabase Inc.</span>
                  <span className="text-slate-500 dark:text-zinc-400">Database & Authentication Hosting</span>
                </div>
                <div className="flex justify-between items-start gap-2">
                  <span className="font-bold text-slate-800 dark:text-white">Expo (650 Industries)</span>
                  <span className="text-slate-500 dark:text-zinc-400">Push Notification Routing Service</span>
                </div>
                <div className="flex justify-between items-start gap-2">
                  <span className="font-bold text-slate-800 dark:text-white">Vercel Inc.</span>
                  <span className="text-slate-500 dark:text-zinc-400">Web App Serverless Hosting</span>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                5. Data Protection and Security
              </h2>
              <p>
                We enforce strict security practices to keep your data safe:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>All data transfer is encrypted using transport layer security (HTTPS/SSL).</li>
                <li>Database tables enforce Supabase Row-Level Security (RLS), restricting lead viewing to authorized owners and admins only.</li>
                <li>Authentication relies on JSON Web Token (JWT) standards to prevent unauthorized session hijacks.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                6. Data Retention & Account Deletion Rights
              </h2>
              <p>
                We retain personal data only as long as necessary to provide administrative services. Administrative users and prospective candidates can request the complete deletion of their account records and candidate details from the database at any time.
              </p>
              <p>
                To learn more about requesting data deletion or to submit a request, please visit our dedicated page: <Link href="/data-deletion" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">Account & Data Deletion Instructions</Link>.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                7. Contact Us
              </h2>
              <p>
                If you have any questions or feedback regarding this Privacy Policy or our data management procedures, please contact us at:
              </p>
              <div className="flex items-center gap-3 p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30 rounded-2xl">
                <Mail className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-700 dark:text-indigo-300">Perfect Scholar Legal Support</p>
                  <a href="mailto:crm@perfectscholar.com" className="text-sm font-semibold text-slate-900 dark:text-white hover:underline">
                    crm@perfectscholar.com
                  </a>
                </div>
              </div>
            </section>

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
