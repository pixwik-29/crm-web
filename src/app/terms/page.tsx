import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, FileText, UserCheck, Scale, AlertTriangle, Mail } from 'lucide-react';

export default function TermsOfServicePage() {
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
              Terms of Service
            </h1>
            <p className="text-xs text-slate-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">
              Perfect Scholar Lead Management System • Last Updated: {lastUpdated}
            </p>
          </div>

          {/* Quick Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div className="p-5 rounded-2xl bg-slate-100/50 dark:bg-zinc-900/30 border border-slate-200/20 dark:border-zinc-800/30 flex items-start gap-3">
              <UserCheck className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-1">Authorized Access</h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">Exclusively for authorized personnel, counsellors, and administrators of Perfect Scholar.</p>
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-100/50 dark:bg-zinc-900/30 border border-slate-200/20 dark:border-zinc-800/30 flex items-start gap-3">
              <Scale className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-1">Data Governance</h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">System users must handle student records and files in full compliance with local privacy laws.</p>
              </div>
            </div>
            <div className="p-5 rounded-2xl bg-slate-100/50 dark:bg-zinc-900/30 border border-slate-200/20 dark:border-zinc-800/30 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-1">Limitation of Use</h4>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">No account sharing, screen scraping, or export of student contact sheets for personal distribution.</p>
              </div>
            </div>
          </div>

          {/* Detailed Terms Text */}
          <div className="space-y-8 text-sm leading-relaxed text-slate-655 dark:text-zinc-350">
            
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                1. Contractual Relationship
              </h2>
              <p>
                These Terms of Service ("Terms") govern the access and use of the <strong>Perfect Scholar CRM</strong> application platform (including web components, API services, and associated mobile apps) by agents, employees, consultants, and independent partners of Perfect Scholar.
              </p>
              <p>
                By accessing this portal, logging in with administrative credentials, or submitting forms, you represent that you are an authorized representative of Perfect Scholar and agree to be bound by these Terms.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                2. User Account Responsibilities
              </h2>
              <p>
                System users are assigned specific profile roles (Admin, Manager, Counsellor) with defined access permissions:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>You are responsible for safeguarding your login credentials (email and password/OTP session).</li>
                <li>You must immediately notify the platform administrator of any unauthorized database access or security breach.</li>
                <li>Sharing account access with unauthorized external entities is strictly prohibited and constitutes grounds for immediate termination of your platform privileges.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                3. Lead Data Handling and Compliance
              </h2>
              <p>
                The Perfect Scholar CRM manages highly sensitive student information, including academic reports, country choices, identity documentation, and communication archives:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>System users must treat student data with extreme confidentiality.</li>
                <li>Any download or export of student contacts, data files, or documentation must be conducted exclusively for authorized academic counselling or visa processing operations.</li>
                <li>Users must respect candidate request preferences (e.g., opting out of automated follow-ups or requesting profile deletion) as mandated by local privacy regulations.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                4. Prohibited Platform Activities
              </h2>
              <p>
                You agree not to perform the following actions while interacting with the CRM system:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Interfere with or attempt to bypass database Row-Level Security (RLS) policies.</li>
                <li>Employ scrapers, bots, or script injections to automatically pull candidate tables or mass-update profile fields.</li>
                <li>Spam student profiles or generate fake leads using the manual web form builder tool.</li>
                <li>Decompile, reverse-engineer, or attempt to extract source codes from the web layouts or mobile Expo bundles.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                5. System Availability and Warranty
              </h2>
              <p>
                The CRM platform is provided "as is" and "as available." While we strive to maintain high system availability, Perfect Scholar does not guarantee that access to the database or push notification cron jobs will be completely uninterrupted or error-free at all times.
              </p>
              <p>
                We reserve the right to perform scheduled system maintenance, update database schemas, or restrict access privileges without prior notice to optimize performance.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                6. Contact for System Inquiries
              </h2>
              <p>
                For questions regarding these Terms, workspace configurations, or to report platform vulnerabilities, please contact:
              </p>
              <div className="flex items-center gap-3 p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30 rounded-2xl">
                <Mail className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-700 dark:text-indigo-300">Perfect Scholar CRM Technical Support</p>
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
