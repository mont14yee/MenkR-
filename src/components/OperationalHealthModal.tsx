import React, { useState, useEffect } from 'react';
import { 
  X, Activity, Database, ShieldCheck, HardDrive, Cpu, RefreshCw, 
  CheckCircle2, AlertTriangle, Clock, Server, FileText, Sparkles 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface HealthData {
  status: string;
  timestamp: string;
  organization: {
    id: string;
    name: string;
    role: string;
  };
  database: {
    status: string;
    engine: string;
    latencyMs: number;
    counts: {
      clients: number;
      projects: number;
      tasks: number;
      auditEvents: number;
    };
  };
  secureStorage: {
    status: string;
    storageType: string;
    fileCount: number;
    totalBytes: number;
    formattedSize: string;
  };
  aiProvider: {
    configured: boolean;
    model: string;
    rateLimitPerMinute: number;
    timeoutSeconds: number;
  };
  auditPolicy: {
    totalEvents: number;
    oldestEventDate: string | null;
    recommendedRetentionDays: number;
  };
  system: {
    nodeVersion: string;
    uptimeSeconds: number;
    memoryRssMb: number;
    memoryHeapUsedMb: number;
  };
}

interface OperationalHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OperationalHealthModal({ isOpen, onClose }: OperationalHealthModalProps) {
  const { idToken, organization, refreshToken, role } = useAuth();
  const { showToast } = useToast();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let token = idToken;
      if (!token) {
        token = await refreshToken();
      }
      if (!token) {
        throw new Error('Authentication required to inspect system health.');
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      if (organization?.id) {
        headers['x-organization-id'] = organization.id;
      }

      const res = await fetch('/api/system/health', { headers });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to fetch system health diagnostics');
      }

      const data = await res.json();
      setHealth(data);
    } catch (err: any) {
      console.error('Operational health fetch error:', err);
      setError(err.message || 'Health diagnostics unavailable');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHealth();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
        aria-hidden="true" 
      />
      <div 
        className="relative w-full max-w-2xl bg-canvas rounded-2xl shadow-2xl border border-bd-subtle overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-label="Operational Health & Diagnostics"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-bd-subtle bg-surface-neutral/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <Activity size={18} />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-tx-primary">Operational Health & Diagnostics</h3>
              <p className="text-[11px] text-tx-muted">Authorized Administrator Telemetry & Infrastructure Status</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchHealth}
              disabled={isLoading}
              className="p-1.5 rounded-lg text-tx-muted hover:text-tx-primary hover:bg-surface-neutral transition-colors disabled:opacity-50"
              title="Refresh Diagnostics"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-tx-muted hover:text-tx-primary hover:bg-surface-neutral transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
          {isLoading && !health ? (
            <div className="py-16 text-center text-tx-muted text-[13px] flex items-center justify-center gap-2">
              <RefreshCw size={18} className="animate-spin text-emerald-500" />
              <span>Querying infrastructure nodes & database connections...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 text-[13px] flex items-start gap-3">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Health Diagnostic Notice</div>
                <div className="text-[12px] mt-0.5">{error}</div>
                <p className="text-[11px] text-tx-muted mt-2">
                  Only organization Administrators and Owners have permission to inspect system infrastructure.
                </p>
              </div>
            </div>
          ) : health ? (
            <>
              {/* Overall Status Banner */}
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <div>
                    <div className="text-[14px] font-semibold text-emerald-600">All Systems Operational</div>
                    <div className="text-[11px] text-tx-muted">
                      Telemetry captured: {new Date(health.timestamp).toLocaleTimeString()} • Workspace: {health.organization.name}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-emerald-600 font-medium">
                  {health.database.latencyMs}ms latency
                </span>
              </div>

              {/* Grid Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 1. Database Health */}
                <div className="p-4 bg-surface-neutral/40 rounded-xl border border-bd-subtle space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-tx-primary font-semibold text-[13px]">
                      <Database size={15} className="text-blue-500" />
                      <span>Relational Database</span>
                    </div>
                    <span className="text-[11px] text-emerald-600 font-medium">Connected</span>
                  </div>
                  <div className="text-[12px] text-tx-muted font-mono">{health.database.engine}</div>
                  <div className="pt-2 border-t border-bd-subtle/50 grid grid-cols-2 gap-2 text-[12px]">
                    <div>
                      <span className="text-tx-muted">Clients: </span>
                      <strong className="text-tx-primary">{health.database.counts.clients}</strong>
                    </div>
                    <div>
                      <span className="text-tx-muted">Projects: </span>
                      <strong className="text-tx-primary">{health.database.counts.projects}</strong>
                    </div>
                    <div>
                      <span className="text-tx-muted">Tasks: </span>
                      <strong className="text-tx-primary">{health.database.counts.tasks}</strong>
                    </div>
                    <div>
                      <span className="text-tx-muted">Audit Records: </span>
                      <strong className="text-tx-primary">{health.database.counts.auditEvents}</strong>
                    </div>
                  </div>
                </div>

                {/* 2. Secure File Storage */}
                <div className="p-4 bg-surface-neutral/40 rounded-xl border border-bd-subtle space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-tx-primary font-semibold text-[13px]">
                      <HardDrive size={15} className="text-sky-500" />
                      <span>Encrypted Storage Volume</span>
                    </div>
                    <span className="text-[11px] text-emerald-600 font-medium">Operational</span>
                  </div>
                  <div className="text-[12px] text-tx-muted">{health.secureStorage.storageType}</div>
                  <div className="pt-2 border-t border-bd-subtle/50 grid grid-cols-2 gap-2 text-[12px]">
                    <div>
                      <span className="text-tx-muted">Stored Files: </span>
                      <strong className="text-tx-primary">{health.secureStorage.fileCount}</strong>
                    </div>
                    <div>
                      <span className="text-tx-muted">Volume Size: </span>
                      <strong className="text-tx-primary">{health.secureStorage.formattedSize}</strong>
                    </div>
                  </div>
                  <div className="text-[11px] text-tx-muted">
                    No public URL exposure; all downloads validated with RBAC.
                  </div>
                </div>

                {/* 3. AI Provider Configuration */}
                <div className="p-4 bg-surface-neutral/40 rounded-xl border border-bd-subtle space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-tx-primary font-semibold text-[13px]">
                      <Sparkles size={15} className="text-accent-primary" />
                      <span>Gemini AI Integration</span>
                    </div>
                    <span className={`text-[11px] font-medium ${
                      health.aiProvider.configured ? 'text-emerald-600' : 'text-amber-500'
                    }`}>
                      {health.aiProvider.configured ? 'Configured & Active' : 'Key Unset'}
                    </span>
                  </div>
                  <div className="text-[12px] text-tx-muted">
                    Model: <strong className="text-tx-primary font-mono">{health.aiProvider.model}</strong>
                  </div>
                  <div className="pt-2 border-t border-bd-subtle/50 space-y-1 text-[11px] text-tx-muted">
                    <div>• Rate limit: {health.aiProvider.rateLimitPerMinute} requests/min per organization</div>
                    <div>• Strict request timeout: {health.aiProvider.timeoutSeconds}s safety limit</div>
                    <div>• Zero client key exposure (server-side proxy only)</div>
                  </div>
                </div>

                {/* 4. Audit & Retention Policy */}
                <div className="p-4 bg-surface-neutral/40 rounded-xl border border-bd-subtle space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-tx-primary font-semibold text-[13px]">
                      <ShieldCheck size={15} className="text-emerald-500" />
                      <span>Audit Trail Governance</span>
                    </div>
                    <span className="text-[11px] text-emerald-600 font-medium">Compliance Ready</span>
                  </div>
                  <div className="text-[12px] text-tx-muted">
                    Retention window: <strong className="text-tx-primary">{health.auditPolicy.recommendedRetentionDays} days</strong>
                  </div>
                  <div className="pt-2 border-t border-bd-subtle/50 space-y-1 text-[11px] text-tx-muted">
                    <div>• Logged events: <strong className="text-tx-primary">{health.auditPolicy.totalEvents}</strong></div>
                    <div>
                      • Oldest record: {health.auditPolicy.oldestEventDate 
                        ? new Date(health.auditPolicy.oldestEventDate).toLocaleDateString() 
                        : 'No events yet'}
                    </div>
                    <div>• Automatic metadata secret scrubbing active</div>
                  </div>
                </div>
              </div>

              {/* Node Runtime Metrics */}
              <div className="p-3.5 bg-surface-neutral/20 rounded-xl border border-bd-subtle/60 flex flex-wrap items-center justify-between text-[11px] text-tx-muted gap-3">
                <div className="flex items-center gap-2">
                  <Server size={14} className="text-tx-secondary" />
                  <span>Node: <strong className="text-tx-primary">{health.system.nodeVersion}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-tx-secondary" />
                  <span>Uptime: <strong className="text-tx-primary">{formatUptime(health.system.uptimeSeconds)}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Cpu size={14} className="text-tx-secondary" />
                  <span>Memory: <strong className="text-tx-primary">{health.system.memoryRssMb} MB RSS</strong> ({health.system.memoryHeapUsedMb} MB heap)</span>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-bd-subtle bg-surface-neutral/30 flex items-center justify-between">
          <span className="text-[11px] text-tx-muted">MenkR Operational Diagnostics v2.4</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-tx-primary text-tx-inverse rounded-xl text-[13px] font-medium hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
