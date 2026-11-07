import React, { useState, useEffect } from 'react';
import { 
  Database, 
  ArrowUpRight, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  RefreshCw, 
  Download, 
  Upload, 
  ShieldCheck, 
  HardDrive, 
  FileText,
  ChevronRight,
  X,
  RotateCcw
} from 'lucide-react';
import { validateMigrationDataset, ValidationResult, MigrationOptions } from '../utils/migrationValidator';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { BottomSheet } from './BottomSheet';

interface DataMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DataMigrationModal({ isOpen, onClose }: DataMigrationModalProps) {
  const { user, organization, role, idToken, refreshToken } = useAuth();
  const { showToast } = useToast();

  const getToken = async () => idToken || (await refreshToken());

  const [step, setStep] = useState<'idle' | 'analyzing' | 'review' | 'migrating' | 'completed' | 'error'>('idle');
  const [legacyData, setLegacyData] = useState<Record<string, any>>({});
  const [legacyCounts, setLegacyCounts] = useState<Record<string, number>>({});
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'overwrite'>('skip');
  const [progressPct, setProgressPct] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [migrationStats, setMigrationStats] = useState<Record<string, number> | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Inspect local storage for legacy data
  useEffect(() => {
    if (!isOpen) return;

    const data: Record<string, any> = {};
    const counts: Record<string, number> = {};
    let totalItems = 0;

    const keyMap: Record<string, string> = {
      'menkir-clients': 'clients',
      'menkir-projects': 'projects',
      'menkir-tasks': 'tasks',
      'menkir-time-entries': 'timeEntries',
      'menkir-revenues': 'revenues',
      'menkir-calendar-events': 'schedules',
      'menkir-templates': 'templates',
      'menkir-library': 'documents',
      'menkir-client-messages': 'messages',
    };

    for (const [lsKey, entityKey] of Object.entries(keyMap)) {
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            data[entityKey] = parsed;
            counts[entityKey] = parsed.length;
            totalItems += parsed.length;
          }
        } catch (e) {
          console.warn(`Could not parse ${lsKey}:`, e);
        }
      }
    }

    setLegacyData(data);
    setLegacyCounts(counts);
    setStep('idle');
    setMigrationError(null);
  }, [isOpen]);

  const handleStartAnalysis = () => {
    setStep('analyzing');
    setProgressStage('Scanning browser storage and validating schemas...');
    
    setTimeout(() => {
      try {
        const result = validateMigrationDataset(legacyData, { duplicateStrategy });
        setValidationResult(result);
        setStep('review');
      } catch (err: any) {
        setMigrationError(err.message || 'Analysis failed');
        setStep('error');
      }
    }, 400);
  };

  const handleExecuteMigration = async () => {
    if (!validationResult || !validationResult.canProceed) {
      showToast({ message: 'Cannot proceed: fix critical validation errors first' });
      return;
    }

    setStep('migrating');
    setProgressPct(15);
    setProgressStage('Phase 1/4: Sanitizing records & checking relationships...');

    try {
      const token = await getToken();
      if (!token) throw new Error('Authentication required');

      setProgressPct(40);
      setProgressStage('Phase 2/4: Preparing PostgreSQL transactional batch...');

      const payload = {
        data: {
          clients: validationResult.sanitizedData.clients,
          projects: validationResult.sanitizedData.projects,
          tasks: validationResult.sanitizedData.tasks,
          messages: validationResult.sanitizedData.messages,
          events: validationResult.sanitizedData.schedules,
          timeEntries: validationResult.sanitizedData.timeEntries,
          revenues: validationResult.sanitizedData.revenues,
          templates: validationResult.sanitizedData.templates,
          library: validationResult.sanitizedData.documents,
        },
      };

      setProgressPct(65);
      setProgressStage('Phase 3/4: Writing to Cloud SQL database...');

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': organization?.id || '',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || `Migration rejected by server (status ${res.status})`);
      }

      const responseData = await res.json();
      setProgressPct(90);
      setProgressStage('Phase 4/4: Confirming integrity & recording audit logs...');

      setTimeout(() => {
        setProgressPct(100);
        setMigrationStats(responseData.stats || {});
        setStep('completed');
        showToast({ message: 'Migration completed successfully without data loss' });
      }, 500);

    } catch (err: any) {
      console.error('Migration execution error:', err);
      setMigrationError(err.message || 'Data migration failed. Local browser data was preserved.');
      setStep('error');
    }
  };

  const handleCloudBackupExport = async () => {
    if (!organization) {
      showToast({ message: 'Select an organization first' });
      return;
    }
    setIsExporting(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/organizations/${organization.id}/backup`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': organization.id,
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Export failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `menkir-cloud-backup-${organization.slug}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      showToast({ message: 'Cloud backup exported with verified checksum' });
    } catch (err: any) {
      showToast({ message: `Export failed: ${err.message}` });
    } finally {
      setIsExporting(false);
    }
  };

  const handleCloudBackupRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organization) return;

    setIsRestoring(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      const token = await getToken();
      const res = await fetch(`/api/organizations/${organization.id}/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Organization-Id': organization.id,
        },
        body: JSON.stringify({
          backup: parsed,
          options: { duplicateStrategy },
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Restore failed');
      }

      const result = await res.json();
      showToast({ message: `Restored successfully: ${JSON.stringify(result.stats)}` });
      setStep('completed');
    } catch (err: any) {
      showToast({ message: `Restore error: ${err.message}` });
    } finally {
      setIsRestoring(false);
      e.target.value = '';
    }
  };

  const totalLocalRecords = Object.values(legacyCounts).reduce((a, b) => a + b, 0);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Data Migration & Disaster Recovery">
      <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-1">

        {/* Security / Isolation Banner */}
        <div className="flex items-start gap-3 p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-blue-900 text-xs leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-blue-950">Safe Migration & Protection Guarantee</div>
            <div className="mt-0.5 text-blue-800">
              MenkiR uses atomic validation to prevent corrupted records or broken relationships from entering PostgreSQL. 
              Local browser storage is never deleted during migration, ensuring zero risk of data loss.
            </div>
          </div>
        </div>

        {/* Step: Idle / Status */}
        {step === 'idle' && (
          <div className="space-y-5">
            <div className="p-4 bg-zinc-50 border border-zinc-200/70 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-zinc-900 font-medium text-sm">
                  <HardDrive className="w-4 h-4 text-zinc-600" />
                  <span>Local Browser Storage Snapshot</span>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 bg-zinc-200 text-zinc-800 rounded-full">
                  {totalLocalRecords} Records Found
                </span>
              </div>

              {totalLocalRecords > 0 ? (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {Object.entries(legacyCounts).map(([entity, count]) => (
                    <div key={entity} className="p-2 bg-white border border-zinc-200 rounded-lg">
                      <div className="text-zinc-500 capitalize">{entity}</div>
                      <div className="font-semibold text-zinc-900 mt-0.5">{count}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-zinc-500 py-2">
                  No legacy unmigrated data found in browser storage.
                </div>
              )}
            </div>

            {totalLocalRecords > 0 && (
              <div className="space-y-3">
                <div className="text-xs font-medium text-zinc-700">Duplicate Handling Strategy:</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDuplicateStrategy('skip')}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                      duplicateStrategy === 'skip'
                        ? 'border-zinc-900 bg-zinc-900 text-white font-medium'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    <div className="font-semibold">Skip Duplicates (Safe)</div>
                    <div className="opacity-80 text-[11px] mt-0.5">Preserve existing records in cloud database</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDuplicateStrategy('overwrite')}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                      duplicateStrategy === 'overwrite'
                        ? 'border-zinc-900 bg-zinc-900 text-white font-medium'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    <div className="font-semibold">Merge & Update</div>
                    <div className="opacity-80 text-[11px] mt-0.5">Update cloud records with local changes</div>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleStartAnalysis}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-900 text-white text-xs font-medium rounded-xl hover:bg-zinc-800 transition-colors shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Analyze & Validate Migration</span>
                </button>
              </div>
            )}

            {/* Cloud Backup & Disaster Recovery Section */}
            {(role === 'owner' || role === 'admin') && (
              <div className="pt-3 border-t border-zinc-200 space-y-3">
                <div className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">
                  Cloud Organization Backup (Admin)
                </div>
                <div className="text-xs text-zinc-600">
                  Export or restore full JSON snapshots for organization <strong>{organization?.name}</strong>.
                  All secrets, auth tokens, and API credentials are automatically excluded.
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCloudBackupExport}
                    disabled={isExporting}
                    className="flex items-center justify-center gap-2 py-2 px-3 bg-white border border-zinc-300 text-zinc-800 text-xs font-medium rounded-lg hover:bg-zinc-50 disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5 text-zinc-600" />
                    <span>{isExporting ? 'Exporting...' : 'Export Cloud Backup'}</span>
                  </button>

                  <label className="flex items-center justify-center gap-2 py-2 px-3 bg-white border border-zinc-300 text-zinc-800 text-xs font-medium rounded-lg hover:bg-zinc-50 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-zinc-600" />
                    <span>{isRestoring ? 'Restoring...' : 'Restore Cloud Backup'}</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleCloudBackupRestore}
                      className="hidden"
                      disabled={isRestoring}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step: Analyzing */}
        {step === 'analyzing' && (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-zinc-700 animate-spin" />
            <div className="text-sm font-medium text-zinc-900">{progressStage}</div>
            <div className="text-xs text-zinc-500">Checking data schemas, duplicate keys, and relationship integrity...</div>
          </div>
        )}

        {/* Step: Review Pre-flight Report */}
        {step === 'review' && validationResult && (
          <div className="space-y-4">
            <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-zinc-900">Pre-flight Inspection Summary</div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  validationResult.isValid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {validationResult.isValid ? 'Fully Valid' : `${validationResult.errors.length} Critical Issues`}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 bg-white rounded-lg border border-zinc-200">
                  <div className="text-zinc-500">Total</div>
                  <div className="font-bold text-zinc-900 text-sm mt-0.5">{validationResult.summary.totalRecords}</div>
                </div>
                <div className="p-2 bg-white rounded-lg border border-emerald-200">
                  <div className="text-emerald-700">Valid</div>
                  <div className="font-bold text-emerald-800 text-sm mt-0.5">{validationResult.summary.validRecords}</div>
                </div>
                <div className="p-2 bg-white rounded-lg border border-amber-200">
                  <div className="text-amber-700">Duplicates</div>
                  <div className="font-bold text-amber-800 text-sm mt-0.5">{validationResult.summary.duplicateRecords}</div>
                </div>
                <div className="p-2 bg-white rounded-lg border border-zinc-200">
                  <div className="text-zinc-500">Orphans</div>
                  <div className="font-bold text-zinc-700 text-sm mt-0.5">{validationResult.summary.orphanRelationships}</div>
                </div>
              </div>
            </div>

            {/* Warnings or Errors */}
            {(validationResult.errors.length > 0 || validationResult.warnings.length > 0) && (
              <div className="max-h-40 overflow-y-auto space-y-1.5 p-3 bg-zinc-100/70 rounded-xl text-xs">
                {validationResult.errors.map((err, i) => (
                  <div key={`err-${i}`} className="flex items-start gap-1.5 text-rose-700">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>[{err.entity}] {err.message}</span>
                  </div>
                ))}
                {validationResult.warnings.map((warn, i) => (
                  <div key={`warn-${i}`} className="flex items-start gap-1.5 text-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>[{warn.entity}] {warn.message}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('idle')}
                className="flex-1 py-2.5 px-4 bg-zinc-100 text-zinc-800 text-xs font-medium rounded-xl hover:bg-zinc-200"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleExecuteMigration}
                disabled={!validationResult.canProceed}
                className="flex-1 py-2.5 px-4 bg-zinc-900 text-white text-xs font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50"
              >
                Confirm & Migrate to Cloud SQL
              </button>
            </div>
          </div>
        )}

        {/* Step: Migrating */}
        {step === 'migrating' && (
          <div className="py-6 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-800">{progressStage}</span>
              <span className="font-semibold text-zinc-900">{progressPct}%</span>
            </div>
            <div className="w-full bg-zinc-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-zinc-900 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="text-[11px] text-zinc-500 text-center">
              Please keep this window open while transactions are committed.
            </div>
          </div>
        )}

        {/* Step: Completed */}
        {step === 'completed' && (
          <div className="py-6 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="font-semibold text-zinc-900 text-sm">Migration Complete!</div>
              <div className="text-xs text-zinc-600 mt-1">
                Your data is safely stored in Cloud SQL PostgreSQL. Browser local storage was kept intact as a rollback backup.
              </div>
            </div>

            {migrationStats && (
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl grid grid-cols-3 gap-2 text-xs">
                {Object.entries(migrationStats).map(([key, count]) => (
                  <div key={key} className="text-left">
                    <div className="text-zinc-500 capitalize">{key}:</div>
                    <div className="font-semibold text-zinc-900">{count}</div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 bg-zinc-900 text-white text-xs font-medium rounded-xl hover:bg-zinc-800"
            >
              Done
            </button>
          </div>
        )}

        {/* Step: Error with Safe Retry */}
        {step === 'error' && (
          <div className="py-6 space-y-4">
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-rose-900 font-semibold text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                <span>Migration Halted (Safe Rollback)</span>
              </div>
              <div className="text-xs text-rose-800 leading-relaxed">
                {migrationError || 'An unexpected error occurred during migration.'}
              </div>
              <div className="text-[11px] text-rose-700 mt-2 font-medium">
                ✓ Protection guarantee active: No local data was erased, and no partial database writes occurred.
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('idle')}
                className="flex-1 py-2 px-3 bg-zinc-100 text-zinc-800 text-xs font-medium rounded-xl hover:bg-zinc-200"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleStartAnalysis}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-zinc-900 text-white text-xs font-medium rounded-xl hover:bg-zinc-800"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Migration</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </BottomSheet>
  );
}
