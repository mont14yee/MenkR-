import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, ShieldCheck, Search, Filter, Download, Trash2, RefreshCw, 
  User, Calendar, Clock, ArrowRight, ShieldAlert, CheckCircle2, ChevronRight 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from './ConfirmDialog';

interface AuditActor {
  id: string;
  name: string;
  email?: string;
  avatarSeed?: string;
}

export interface AuditEventItem {
  id: string;
  organizationId: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, any>;
  ipAddress: string | null;
  createdAt: string;
  actor: AuditActor | null;
}

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuditCategory = 'all' | 'membership' | 'projects' | 'finance' | 'data' | 'system';

export function AuditLogModal({ isOpen, onClose }: AuditLogModalProps) {
  const { idToken, organization, refreshToken, role } = useAuth();
  const { showToast } = useToast();

  const [logs, setLogs] = useState<AuditEventItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AuditCategory>('all');
  const [selectedEvent, setSelectedEvent] = useState<AuditEventItem | null>(null);

  // Retention management state
  const [isRetentionDialogOpen, setIsRetentionDialogOpen] = useState(false);
  const [retentionDays, setRetentionDays] = useState(90);
  const [isPruning, setIsPruning] = useState(false);

  const canManageRetention = role === 'owner' || role === 'admin';

  const loadAuditLogs = async () => {
    setIsLoading(true);
    try {
      let token = idToken;
      if (!token) {
        token = await refreshToken();
      }
      if (!token) {
        throw new Error('Authentication required to access audit logs');
      }

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      if (organization?.id) {
        headers['x-organization-id'] = organization.id;
      }

      const params = new URLSearchParams({ limit: '100' });
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }

      const res = await fetch(`/api/audit-events?${params.toString()}`, { headers });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to retrieve audit events');
      }

      const data = await res.json();
      const events: AuditEventItem[] = Array.isArray(data) ? data : (data.events || []);
      setLogs(events);
      setTotalCount(data.total || events.length);
    } catch (err: any) {
      console.error('Audit log fetch error:', err);
      showToast({ message: err.message || 'Failed to load audit events' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAuditLogs();
    }
  }, [isOpen]);

  const handlePruneRetention = async () => {
    setIsPruning(true);
    try {
      let token = idToken;
      if (!token) {
        token = await refreshToken();
      }
      if (!token) {
        throw new Error('Authentication required');
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
      if (organization?.id) {
        headers['x-organization-id'] = organization.id;
      }

      const res = await fetch('/api/audit-events/retention', {
        method: 'POST',
        headers,
        body: JSON.stringify({ retentionDays }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to prune audit events');
      }

      const data = await res.json();
      showToast({ message: `Pruned ${data.prunedCount} records older than ${retentionDays} days.` });
      setIsRetentionDialogOpen(false);
      await loadAuditLogs();
    } catch (err: any) {
      console.error('Prune error:', err);
      showToast({ message: err.message || 'Pruning failed' });
    } finally {
      setIsPruning(false);
    }
  };

  const handleExportAuditCsv = () => {
    if (logs.length === 0) {
      showToast({ message: 'No audit records to export.' });
      return;
    }

    const headers = ['ID', 'Timestamp', 'Actor', 'Action', 'Entity Type', 'Entity ID', 'IP Address', 'Metadata'];
    const rows = filteredLogs.map(l => [
      l.id,
      l.createdAt,
      l.actor?.email || l.actor?.name || l.userId || 'System',
      l.action,
      l.entityType,
      l.entityId || '',
      l.ipAddress || '',
      JSON.stringify(l.metadata || {}).replace(/"/g, '""'),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(field => `"${field}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `menkir-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast({ message: 'Audit log exported to CSV.' });
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Category filter
      if (selectedCategory === 'membership') {
        if (!log.action.startsWith('membership.') && !log.action.startsWith('invitation.')) return false;
      } else if (selectedCategory === 'projects') {
        if (!log.action.startsWith('project.') && !log.action.startsWith('task.')) return false;
      } else if (selectedCategory === 'finance') {
        if (!log.action.startsWith('financial.') && !log.action.startsWith('revenue.')) return false;
      } else if (selectedCategory === 'data') {
        if (!log.action.startsWith('data.') && !log.action.startsWith('backup.')) return false;
      } else if (selectedCategory === 'system') {
        if (!log.action.startsWith('ai.') && !log.action.startsWith('audit.') && !log.action.startsWith('organization.')) return false;
      }

      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesAction = log.action.toLowerCase().includes(q);
        const matchesEntity = log.entityType.toLowerCase().includes(q);
        const matchesActor = log.actor?.name?.toLowerCase().includes(q) || log.actor?.email?.toLowerCase().includes(q);
        const matchesId = log.entityId?.toLowerCase().includes(q);
        return matchesAction || matchesEntity || matchesActor || matchesId;
      }

      return true;
    });
  }, [logs, selectedCategory, searchQuery]);

  if (!isOpen) return null;

  const categories: { id: AuditCategory; label: string }[] = [
    { id: 'all', label: 'All Actions' },
    { id: 'membership', label: 'Membership & RBAC' },
    { id: 'projects', label: 'Projects & Tasks' },
    { id: 'finance', label: 'Financial' },
    { id: 'data', label: 'Data & Sync' },
    { id: 'system', label: 'Security & System' },
  ];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
        aria-hidden="true" 
      />
      <div 
        className="relative w-full max-w-3xl bg-canvas rounded-2xl shadow-2xl border border-bd-subtle overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-label="Activity and Security Audit Trail"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-bd-subtle bg-surface-neutral/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-tx-primary">Enterprise Audit & Activity Log</h3>
              <p className="text-[11px] text-tx-muted">
                Immutable, governance-ready operational events recorded in PostgreSQL
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportAuditCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-bd-subtle bg-canvas text-tx-primary text-[12px] font-medium hover:bg-surface-neutral transition-colors"
              title="Export CSV"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>
            {canManageRetention && (
              <button
                onClick={() => setIsRetentionDialogOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-bd-subtle bg-canvas text-tx-muted hover:text-red-500 hover:border-red-500/40 text-[12px] font-medium transition-colors"
                title="Retention Policy"
              >
                <Trash2 size={13} />
                <span>Retention</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-tx-muted hover:text-tx-primary hover:bg-surface-neutral transition-colors ml-1"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Search & Category Filter Toolbar */}
        <div className="p-3 border-b border-bd-subtle bg-canvas space-y-2.5">
          <div className="flex items-center gap-2 px-3 py-2 bg-surface-neutral/50 rounded-xl border border-bd-subtle">
            <Search size={16} className="text-tx-muted shrink-0" />
            <input
              type="text"
              placeholder="Filter by action name, actor, entity ID, or type..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-[13px] text-tx-primary placeholder:text-tx-muted"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-tx-muted hover:text-tx-primary">
                <X size={14} />
              </button>
            )}
            <button onClick={loadAuditLogs} className="text-tx-muted hover:text-tx-primary" title="Refresh">
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {categories.map(cat => {
              const active = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-colors whitespace-nowrap ${
                    active 
                      ? 'bg-tx-primary text-tx-inverse' 
                      : 'text-tx-muted hover:text-tx-primary hover:bg-surface-neutral'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
          {isLoading && logs.length === 0 ? (
            <div className="py-16 text-center text-tx-muted text-[13px] flex items-center justify-center gap-2">
              <RefreshCw size={18} className="animate-spin text-emerald-500" />
              <span>Loading audit trail...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-14 text-center">
              <ShieldCheck size={28} className="mx-auto text-tx-muted/60 mb-2" />
              <div className="text-[14px] font-medium text-tx-primary">No audit events match your filter</div>
              <p className="text-[12px] text-tx-muted mt-1 max-w-sm mx-auto">
                Actions such as team invites, member updates, project changes, and data exports are logged automatically.
              </p>
            </div>
          ) : (
            filteredLogs.map(item => {
              const isSelected = selectedEvent?.id === item.id;
              const dateObj = new Date(item.createdAt);
              const formattedDate = dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
              const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedEvent(isSelected ? null : item)}
                  className={`p-3 rounded-xl border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-accent-primary/10 border-accent-primary/50'
                      : 'bg-surface-neutral/40 border-bd-subtle hover:border-bd-subtle/80 hover:bg-surface-neutral/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {item.actor ? (
                        <img
                          src={`https://api.dicebear.com/7.x/notionists/svg?seed=${item.actor.avatarSeed || item.actor.id}`}
                          alt="Avatar"
                          className="w-8 h-8 rounded-full bg-surface-neutral shrink-0 border border-bd-subtle"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-surface-neutral shrink-0 border border-bd-subtle flex items-center justify-center text-tx-muted">
                          <User size={14} />
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[13px] font-semibold text-tx-primary">
                            {item.action}
                          </span>
                          <span className="text-[11px] text-tx-muted">
                            on <strong className="text-tx-secondary">{item.entityType}</strong>
                          </span>
                        </div>
                        <div className="text-[12px] text-tx-muted mt-0.5 truncate">
                          Actor: <span className="text-tx-primary font-medium">{item.actor?.name || item.actor?.email || 'System Background Job'}</span>
                          {item.ipAddress && <span className="ml-2">({item.ipAddress})</span>}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[11px] text-tx-muted flex items-center gap-1 justify-end font-mono">
                        <Clock size={11} />
                        {formattedTime}
                      </div>
                      <div className="text-[11px] text-tx-muted mt-0.5">
                        {formattedDate}
                      </div>
                    </div>
                  </div>

                  {/* Expanded metadata inspector */}
                  {isSelected && (
                    <div className="mt-3 pt-3 border-t border-bd-subtle/60 text-[12px] space-y-2 animate-in fade-in duration-100">
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-tx-muted">
                        <div>Event ID: <span className="font-mono text-tx-primary">{item.id}</span></div>
                        <div>Target ID: <span className="font-mono text-tx-primary">{item.entityId || 'None'}</span></div>
                      </div>

                      {item.metadata && Object.keys(item.metadata).length > 0 && (
                        <div className="space-y-1">
                          <div className="text-[11px] font-semibold text-tx-muted uppercase tracking-wider">
                            Non-Sensitive Event Metadata:
                          </div>
                          <div className="p-2.5 bg-canvas rounded-lg border border-bd-subtle font-mono text-[11px] text-tx-primary overflow-x-auto space-y-1">
                            {Object.entries(item.metadata).map(([k, v]) => (
                              <div key={k} className="flex items-start gap-2">
                                <span className="text-tx-muted">{k}:</span>
                                <span className="text-tx-primary">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-bd-subtle bg-surface-neutral/30 flex items-center justify-between text-[11px] text-tx-muted">
          <span>Showing {filteredLogs.length} of {totalCount} events</span>
          <span>Automatic secret scrubbing active</span>
        </div>
      </div>

      {/* Retention Policy Dialog */}
      <ConfirmDialog
        isOpen={isRetentionDialogOpen}
        onCancel={() => setIsRetentionDialogOpen(false)}
        title="Enforce Audit Log Retention"
        body={`This will permanently delete audit records older than ${retentionDays} days for compliance. This action is irreversible.`}
        confirmLabel={isPruning ? "Pruning..." : "Prune Records"}
        cancelLabel="Cancel"
        danger
        onConfirm={handlePruneRetention}
      />
    </div>
  );
}
