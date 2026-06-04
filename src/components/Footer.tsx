import React from 'react';
import Link from 'next/link';
import { ShieldCheck, HelpCircle, FileText } from 'lucide-react';

interface FooterProps {
  isLoginScreen?: boolean;
}

export const Footer: React.FC<FooterProps> = ({ isLoginScreen = false }) => {
  const year = new Date().getFullYear();

  if (isLoginScreen) {
    return (
      <footer className="w-full border-t border-slate-800/60 bg-slate-950/40 backdrop-blur-md py-6 px-4 mt-8 relative z-10 transition-colors duration-300">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          {/* Left section */}
          <div className="flex items-center gap-2 text-slate-500 font-medium">
            <span>© {year} Perfect Scholar. All rights reserved.</span>
          </div>

          {/* Right section */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-slate-400 font-semibold">
            <Link 
              href="/privacy" 
              className="hover:text-blue-400 transition-colors flex items-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Privacy Policy
            </Link>
            <Link 
              href="/terms" 
              className="hover:text-blue-400 transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              Terms of Service
            </Link>
            <Link 
              href="/data-deletion" 
              className="hover:text-blue-400 transition-colors flex items-center gap-1.5"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Account Deletion
            </Link>
          </div>
        </div>
      </footer>
    );
  }

  // Dashboard Footer (Theme-aware)
  return (
    <footer className="w-full border-t border-slate-200/80 dark:border-zinc-900/80 bg-white/70 dark:bg-zinc-950/50 backdrop-blur-xl py-6 px-6 mt-12 transition-colors duration-300">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        {/* Left section */}
        <div className="flex items-center gap-2 text-slate-400 dark:text-zinc-500 font-medium">
          <span>© {year} Perfect Scholar. All rights reserved.</span>
          <span className="hidden sm:inline text-slate-300 dark:text-zinc-800">•</span>
          <span className="hidden sm:inline font-bold uppercase tracking-wider text-[10px]">Workspace CRM v1.0</span>
        </div>

        {/* Right section */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-slate-500 dark:text-slate-400 font-semibold">
          <Link 
            href="/privacy" 
            className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Privacy Policy
          </Link>
          <Link 
            href="/terms" 
            className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            Terms of Service
          </Link>
          <Link 
            href="/data-deletion" 
            className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Account Deletion
          </Link>
        </div>
      </div>
    </footer>
  );
};
