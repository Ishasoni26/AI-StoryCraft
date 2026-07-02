"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, AlertCircle, Clock, Pause, Play } from 'lucide-react';
import { ProgressPhase } from '@/lib/long-video/types';

interface ProgressTrackerProps {
  phases: ProgressPhase[];
  overallPercent: number;
  estimatedTimeRemaining: number; // seconds
  isVisible: boolean;
  isPaused?: boolean;
  onPause?: () => void;
  onResume?: () => void;
}

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return '0 sec';
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60);
  if (min === 0) return `${sec} sec`;
  if (sec === 0) return `${min} min`;
  return `${min} min ${sec} sec`;
}

function PhaseStatusIcon({ status }: { status: ProgressPhase['status'] }) {
  switch (status) {
    case 'complete':
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        </motion.div>
      );
    case 'in-progress':
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="w-5 h-5 text-blue-400" />
        </motion.div>
      );
    case 'error':
      return <AlertCircle className="w-5 h-5 text-red-400" />;
    case 'pending':
    default:
      return (
        <div className="w-5 h-5 rounded-full border-2 border-slate-600" />
      );
  }
}

export default function ProgressTracker({
  phases,
  overallPercent,
  estimatedTimeRemaining,
  isVisible,
  isPaused = false,
  onPause,
  onResume,
}: ProgressTrackerProps) {
  if (!isVisible) return null;

  const hasActiveGeneration = phases.some(
    (p) => p.status === 'in-progress' && p.id.includes('asset')
  );

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="w-full rounded-xl border border-slate-700/50 bg-slate-900/80 backdrop-blur-sm p-5 shadow-lg"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">
              Progress
            </h3>
            <div className="flex items-center gap-3">
              {estimatedTimeRemaining > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{formatTimeRemaining(estimatedTimeRemaining)}</span>
                </div>
              )}
              {hasActiveGeneration && (onPause || onResume) && (
                <button
                  onClick={isPaused ? onResume : onPause}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300"
                >
                  {isPaused ? (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      Pause
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Overall progress bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-400">Overall</span>
              <span className="text-xs font-medium text-slate-300">
                {Math.round(overallPercent)}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(0, overallPercent))}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Phases list */}
          <div className="space-y-2.5">
            {phases.map((phase) => (
              <motion.div
                key={phase.id}
                layout
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  phase.status === 'in-progress'
                    ? 'bg-slate-800/60 border border-slate-700/50'
                    : ''
                }`}
              >
                <PhaseStatusIcon status={phase.status} />
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-sm ${
                      phase.status === 'complete'
                        ? 'text-slate-500'
                        : phase.status === 'in-progress'
                        ? 'text-slate-200 font-medium'
                        : phase.status === 'error'
                        ? 'text-red-300'
                        : 'text-slate-400'
                    }`}
                  >
                    {phase.label}
                  </span>
                  {phase.detail && (
                    <span className="ml-2 text-xs text-slate-500">
                      {phase.detail}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
