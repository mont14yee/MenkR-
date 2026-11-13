import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Header } from '../components/Shared';
import { useLibrary } from '../context/LibraryContext';
import { useClients } from '../context/ClientsContext';
import { useProjects } from '../context/ProjectsContext';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { EmptyState, Button, IconButton, Badge } from '../components/ui';
import { BottomSheet, BottomSheetField } from '../components/BottomSheet';
import { SearchPicker } from '../components/SearchPicker';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { 
  FolderHeart, Plus, ChevronLeft, Search, Filter, MoreVertical, 
  FileText, Link2, FileImage, File, Star, Download, Trash2, Edit, Share2,
  Calendar, Building2, FolderKanban, ShieldCheck, HardDrive, Lock, ArrowUpRight
} from 'lucide-react';
import { LibraryItem, LibraryCategory } from '../types';
import { validateRequired, validateUrl } from '../utils/validation';

export function Library({ onDismiss }: { onDismiss: () => void }) {
  const { library, addLibraryItem, updateLibraryItem, deleteLibraryItem } = useLibrary();
  const { clients } = useClients();
  const { projects } = useProjects();
  const { navigationOptions, push, goToTab, goToClient } = useNavigation();
  const { showToast } = useToast();
  const { role, idToken, organization } = useAuth();

  const isReadOnly = role === 'viewer';

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<LibraryCategory | 'All'>('All');
  const [filterType, setFilterType] = useState<'all' | 'file' | 'link' | 'note'>('all');
  const [filterClientId, setFilterClientId] = useState(navigationOptions?.clientId || '');
  const [filterProjectId, setFilterProjectId] = useState(navigationOptions?.filterProjectId || '');
  const [filterTaskId, setFilterTaskId] = useState(navigationOptions?.filterTaskId || '');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [isFilterPanelOpen, setFilterPanelOpen] = useState(false);
  const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);

  const [isAddMenuOpen, setAddMenuOpen] = useState(false);
  const [isItemFormOpen, setItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const defaultForm: Partial<LibraryItem> = {
    name: '',
    type: 'file',
    category: 'Documents',
    urlOrReference: '',
    tags: [],
    clientId: filterClientId || '',
    projectId: filterProjectId || ''
  };
  const [form, setForm] = useState<Partial<LibraryItem>>(defaultForm);

  const [actionItem, setActionItem] = useState<LibraryItem | null>(null);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<LibraryItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (navigationOptions?.filterProjectId) setFilterProjectId(navigationOptions.filterProjectId);
    if (navigationOptions?.clientId) setFilterClientId(navigationOptions.clientId);
    if (navigationOptions?.filterTaskId) setFilterTaskId(navigationOptions.filterTaskId);
  }, [navigationOptions?.filterProjectId, navigationOptions?.clientId, navigationOptions?.filterTaskId]);

  const filteredLibrary = useMemo(() => {
    return library.filter(l => {
      const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) || 
                          (l.description || '').toLowerCase().includes(search.toLowerCase()) ||
                          l.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
      const matchCategory = filterCategory === 'All' || l.category === filterCategory;
      const matchType = filterType === 'all' || l.type === filterType;
      const matchClient = filterClientId ? l.clientId === filterClientId : true;
      const matchProject = filterProjectId ? l.projectId === filterProjectId : true;
      const matchTask = filterTaskId ? l.taskId === filterTaskId : true;
      
      return matchSearch && matchCategory && matchType && matchClient && matchProject && matchTask;
    }).sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });
  }, [library, search, filterCategory, filterType, filterClientId, filterProjectId, filterTaskId, sortOrder]);

  const categories: LibraryCategory[] = [
    'Documents', 'Project Files', 'Contracts', 'Proposals', 
    'Reports', 'Images', 'References', 'Templates', 'Design Assets', 'Notes'
  ];

  const handleOpenForm = (type: 'file' | 'link' | 'note', item?: LibraryItem) => {
    if (isReadOnly) {
      showToast({ message: "Viewer mode: Uploading or editing files is restricted." });
      return;
    }
    setAddMenuOpen(false);
    if (item) {
      setEditingItem(item);
      setForm({ ...item });
    } else {
      setEditingItem(null);
      setForm({ 
        ...defaultForm, 
        type,
        clientId: filterClientId || defaultForm.clientId,
        projectId: filterProjectId || defaultForm.projectId,
      });
    }
    setItemFormOpen(true);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 10MB maximum file size limit
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      showToast({ message: "File exceeds the 10MB limit. Please select a file smaller than 10MB." });
      return;
    }

    // Dangerous extension check
    const forbiddenExts = ['.exe', '.bat', '.cmd', '.sh', '.vbs', '.dll', '.msi', '.ps1', '.jar', '.com'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (forbiddenExts.includes(ext)) {
      showToast({ message: `Executable file type (${ext}) is rejected for system security.` });
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      const rawResult = event.target?.result as string;
      const base64Index = rawResult.indexOf('base64,');
      const base64Content = base64Index !== -1 ? rawResult.substring(base64Index + 7) : rawResult;

      let secureFileId: string | undefined;
      let checksum: string | undefined;

      // Real secure storage upload endpoint call
      if (idToken && organization?.id && !isReadOnly) {
        try {
          const uploadRes = await fetch('/api/library/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
              'X-Organization-Id': organization.id,
            },
            body: JSON.stringify({
              name: file.name,
              mimeType: file.type,
              contentBase64: base64Content,
              clientId: form.clientId,
              projectId: form.projectId,
              category: form.category,
            }),
          });

          if (uploadRes.ok) {
            const uploadedMeta = await uploadRes.json();
            secureFileId = uploadedMeta.fileId;
            checksum = uploadedMeta.sha256;
          }
        } catch {
          // Graceful fallback to local encrypted cache
        }
      }

      setForm(prev => ({
        ...prev,
        name: prev.name || file.name,
        size: file.size,
        mimeType: file.type,
        urlOrReference: rawResult,
        fileId: secureFileId,
        sha256: checksum,
        type: 'file'
      }));
      setIsUploading(false);
      showToast({ message: `File "${file.name}" staged (${(file.size / 1024).toFixed(0)} KB)` });
    };

    reader.onerror = () => {
      setIsUploading(false);
      showToast({ message: "Error reading file content." });
    };

    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (isReadOnly) {
      throw new Error('Viewer mode: Uploading or editing files is restricted.');
    }
    const nameVal = validateRequired(form.name, 'Title');
    if (!nameVal.isValid) {
      const msg = 'Item title is required.';
      showToast({ message: msg });
      throw new Error(msg);
    }

    if (form.type === 'link') {
      const reqUrl = validateRequired(form.urlOrReference, 'URL');
      if (!reqUrl.isValid) {
        const msg = 'Please enter a valid web URL.';
        showToast({ message: msg });
        throw new Error(msg);
      }
      const urlVal = validateUrl(form.urlOrReference, true);
      if (!urlVal.isValid) {
        const msg = urlVal.error || 'Please enter a valid web URL.';
        showToast({ message: msg });
        throw new Error(msg);
      }
    }

    if (form.type === 'file' && !form.urlOrReference && !editingItem) {
      const msg = 'Please choose a file to upload.';
      showToast({ message: msg });
      throw new Error(msg);
    }

    try {
      if (editingItem) {
        updateLibraryItem(editingItem.id, { ...form, name: nameVal.value! });
        showToast({ message: 'Library resource updated.' });
      } else {
        addLibraryItem({
          name: nameVal.value!,
          type: form.type as any,
          category: form.category as any,
          urlOrReference: form.urlOrReference || '',
          fileId: form.fileId,
          sha256: form.sha256,
          size: form.size,
          mimeType: form.mimeType,
          description: form.description,
          clientId: form.clientId,
          projectId: form.projectId,
          tags: form.tags || [],
          isFavorite: false
        });
        showToast({ message: 'Resource securely added to library.' });
      }
      setItemFormOpen(false);
    } catch (err: any) {
      const msg = err?.message || 'Unable to save library resource. Please try again.';
      showToast({ message: msg });
      throw err instanceof Error ? err : new Error(msg);
    }
  };

  // Safe Download Handler with Role & Token Validation
  const handleDownload = async (item: LibraryItem) => {
    // If backend fileId is present and authenticated, stream from secure endpoint
    if (item.fileId && idToken && organization?.id) {
      try {
        const res = await fetch(`/api/library/download/${item.fileId}`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
            'X-Organization-Id': organization.id,
          },
        });

        if (res.ok) {
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = item.name;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          showToast({ message: `Downloaded "${item.name}" from secure volume.` });
          setActionItem(null);
          return;
        }
      } catch {
        // Fallback to dataURL
      }
    }

    // Fallback to direct client-side blob or external link
    if (!item.urlOrReference) {
      showToast({ message: "No stored content available for download." });
      return;
    }

    const a = document.createElement('a');
    a.href = item.urlOrReference;
    if (item.type === 'file' && item.urlOrReference.startsWith('data:')) {
      a.download = item.name;
    } else {
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setActionItem(null);
  };

  const handleShare = async (item: LibraryItem) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: item.name,
          text: item.description || `Resource from MenkR- Library`,
          url: item.type === 'link' ? item.urlOrReference : window.location.href,
        });
      } catch (err) {
        console.error(err);
      }
    } else {
      showToast({ message: "Sharing is not supported on this device." });
    }
    setActionItem(null);
  };

  const renderIcon = (type: string, mimeType?: string) => {
    if (type === 'link') return <Link2 size={22} className="text-blue-500" />;
    if (type === 'note') return <FileText size={22} className="text-amber-500" />;
    if (mimeType?.startsWith('image/')) return <FileImage size={22} className="text-green-500" />;
    return <File size={22} className="text-tx-muted" />;
  };

  return (
    <div className="flex flex-col h-full bg-canvas relative animate-in slide-in-from-right-4">
      <Header 
        title="Library" 
        leftIcon={
          <IconButton variant="ghost" onClick={onDismiss} className="-ml-2">
            <ChevronLeft size={24} />
          </IconButton>
        } 
        rightIcon={
          <div className="flex items-center gap-1.5">
            <IconButton 
              variant="outline" 
              onClick={() => setIsStorageModalOpen(true)}
              className="text-tx-secondary hover:text-tx-primary px-2.5 py-1.5 h-auto rounded-xl flex items-center gap-1"
              title="Storage Architecture"
            >
              <ShieldCheck size={15} />
              <span className="hidden sm:inline text-xs font-semibold">Storage Info</span>
            </IconButton>

            {!isReadOnly && (
              <IconButton variant="primary" onClick={() => setAddMenuOpen(true)}>
                <Plus size={20} />
              </IconButton>
            )}
          </div>
        } 
      />

      {/* Viewer Warning */}
      {isReadOnly && (
        <div className="mx-4 mt-2 mb-1 p-2.5 bg-surface-neutral rounded-xl border border-bd-subtle flex items-center gap-2 text-xs text-tx-muted">
          <Lock size={13} className="text-accent-secondary shrink-0" />
          <span>You have <strong>Viewer</strong> access. Document downloads and previews are enabled; uploads and deletions are restricted.</span>
        </div>
      )}

      {/* Search & Category Filter Bar */}
      <div className="px-4 py-3 md:px-8 bg-canvas border-b border-bd-subtle flex flex-col md:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tx-muted" />
          <input 
            type="text" 
            placeholder="Search documents, specifications, links, tags..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-neutral rounded-xl text-xs font-medium outline-none text-tx-primary"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <IconButton 
            variant={filterClientId || filterProjectId || filterType !== 'all' ? 'primary' : 'secondary'} 
            className="shrink-0 rounded-xl" 
            onClick={() => setFilterPanelOpen(true)}
          >
            <Filter size={16} />
          </IconButton>

          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            <button
              onClick={() => setFilterCategory('All')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                filterCategory === 'All' ? 'bg-tx-primary text-canvas' : 'bg-surface-neutral text-tx-muted hover:text-tx-primary'
              }`}
            >
              All Categories
            </button>
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setFilterCategory(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  filterCategory === c ? 'bg-tx-primary text-canvas' : 'bg-surface-neutral text-tx-muted hover:text-tx-primary'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
        {filteredLibrary.length === 0 ? (
          <EmptyState 
            icon={<FolderHeart size={32} />} 
            title="No Resources Found" 
            description="Organize project blueprints, contracts, design assets, and specifications." 
            action={!isReadOnly && <Button onClick={() => setAddMenuOpen(true)}>Add New</Button>} 
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {filteredLibrary.map(item => {
              const linkedProject = projects.find(p => p.id === item.projectId);
              const linkedClient = clients.find(c => c.id === item.clientId || c.id === linkedProject?.clientId);

              return (
                <div 
                  key={item.id} 
                  onClick={() => setPreviewItem(item)}
                  className="group flex flex-col p-3.5 bg-surface-neutral/30 rounded-2xl border border-bd-subtle cursor-pointer hover:border-tx-primary/30 transition-all hover:shadow-xs"
                >
                  <div className="flex justify-between items-start mb-2.5">
                    <div className="w-9 h-9 rounded-xl bg-canvas border border-bd-subtle flex items-center justify-center shrink-0">
                      {renderIcon(item.type, item.mimeType)}
                    </div>
                    <IconButton 
                      variant="ghost" 
                      size="sm" 
                      className="-mt-1.5 -mr-1.5 opacity-60 group-hover:opacity-100 transition-opacity" 
                      onClick={(e) => { e.stopPropagation(); setActionItem(item); }}
                    >
                      <MoreVertical size={15} />
                    </IconButton>
                  </div>
                  
                  <h3 className="font-semibold text-xs text-tx-primary line-clamp-2 leading-snug mb-1" title={item.name}>
                    {item.name}
                  </h3>

                  {/* Contextual Links */}
                  <div className="mt-1 space-y-1">
                    {linkedProject && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-tx-muted truncate max-w-full">
                        <FolderKanban size={10} className="text-accent-primary shrink-0" />
                        <span className="truncate">{linkedProject.name}</span>
                      </span>
                    )}
                    {linkedClient && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-tx-muted truncate max-w-full block">
                        <Building2 size={10} className="text-accent-secondary shrink-0" />
                        <span className="truncate">{linkedClient.name}</span>
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-auto pt-2.5 flex items-center justify-between border-t border-bd-subtle/50 text-[10px] text-tx-muted">
                    <span className="font-medium truncate pr-1">{item.category}</span>
                    {item.isFavorite && <Star size={11} className="fill-accent-primary text-accent-primary shrink-0" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Resource Menu */}
      <BottomSheet isOpen={isAddMenuOpen} onClose={() => setAddMenuOpen(false)} title="Add Resource to Library">
        <div className="grid grid-cols-3 gap-3 py-3">
          <button 
            onClick={() => handleOpenForm('file')} 
            className="flex flex-col items-center gap-2 p-4 bg-surface-neutral/50 rounded-2xl border border-bd-subtle hover:border-tx-primary transition-colors text-center"
          >
            <File size={24} className="text-tx-primary" />
            <span className="text-xs font-semibold text-tx-primary">File</span>
            <span className="text-[10px] text-tx-muted">Max 10MB</span>
          </button>
          <button 
            onClick={() => handleOpenForm('link')} 
            className="flex flex-col items-center gap-2 p-4 bg-surface-neutral/50 rounded-2xl border border-bd-subtle hover:border-tx-primary transition-colors text-center"
          >
            <Link2 size={24} className="text-tx-primary" />
            <span className="text-xs font-semibold text-tx-primary">Link</span>
            <span className="text-[10px] text-tx-muted">Web URL</span>
          </button>
          <button 
            onClick={() => handleOpenForm('note')} 
            className="flex flex-col items-center gap-2 p-4 bg-surface-neutral/50 rounded-2xl border border-bd-subtle hover:border-tx-primary transition-colors text-center"
          >
            <FileText size={24} className="text-tx-primary" />
            <span className="text-xs font-semibold text-tx-primary">Note</span>
            <span className="text-[10px] text-tx-muted">Rich Text</span>
          </button>
        </div>
      </BottomSheet>

      {/* Filter Panel */}
      <BottomSheet isOpen={isFilterPanelOpen} onClose={() => setFilterPanelOpen(false)} title="Filter Library Resources">
        <div className="space-y-3">
          <BottomSheetField label="Type">
            <select 
              value={filterType} 
              onChange={e => setFilterType(e.target.value as any)} 
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-neutral border border-bd-subtle text-xs text-tx-primary outline-none"
            >
              <option value="all">All Types</option>
              <option value="file">Files</option>
              <option value="link">Links</option>
              <option value="note">Notes</option>
            </select>
          </BottomSheetField>
          
          <BottomSheetField label="Linked Client">
            <SearchPicker 
              items={[{ id: '', label: 'All Clients' }, ...clients.map(c => ({ id: c.id, label: c.name }))]} 
              value={filterClientId} 
              onChange={setFilterClientId} 
            />
          </BottomSheetField>
          
          <BottomSheetField label="Linked Project">
            <SearchPicker 
              items={[{ id: '', label: 'All Projects' }, ...projects.map(p => ({ id: p.id, label: p.name }))]} 
              value={filterProjectId} 
              onChange={setFilterProjectId} 
            />
          </BottomSheetField>
          
          <BottomSheetField label="Sort Order">
            <select 
              value={sortOrder} 
              onChange={e => setSortOrder(e.target.value as any)} 
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-neutral border border-bd-subtle text-xs text-tx-primary outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </BottomSheetField>
          
          <div className="pt-2 flex gap-2">
            <Button 
              variant="secondary" 
              className="flex-1"
              onClick={() => {
                setFilterType('all');
                setFilterClientId('');
                setFilterProjectId('');
                setFilterPanelOpen(false);
              }}
            >
              Reset Filters
            </Button>
            <Button variant="primary" className="flex-1" onClick={() => setFilterPanelOpen(false)}>
              Apply
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Item Form */}
      <BottomSheet 
        isOpen={isItemFormOpen} 
        onClose={() => setItemFormOpen(false)} 
        title={editingItem ? "Edit Resource Metadata" : `New ${form.type === 'file' ? 'File' : form.type === 'link' ? 'Link' : 'Note'}`} 
        onSave={handleSave}
        saveLabel="Save Resource"
        savingLabel="Saving..."
        isSaving={isUploading}
        saveDisabled={
          isReadOnly ||
          isUploading ||
          !(form.name || '').trim() ||
          (form.type === 'link' && !validateUrl(form.urlOrReference, true).isValid) ||
          (form.type === 'file' && !editingItem && !form.urlOrReference)
        }
      >
        {form.type === 'file' && !editingItem && (
          <div className="mb-3">
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileSelect} 
            />
            <Button 
              variant="secondary" 
              className="w-full border-dashed" 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? 'Securing & Staging...' : form.urlOrReference ? 'Change File' : 'Select File (Max 10MB)'}
            </Button>
          </div>
        )}

        <BottomSheetField>
          <input 
            type="text" 
            placeholder="Name" 
            value={form.name} 
            onChange={e => setForm({...form, name: e.target.value})} 
            className="w-full text-[17px] font-semibold text-tx-primary placeholder:text-tx-muted/50 bg-transparent outline-none py-1.5" 
          />
        </BottomSheetField>
        
        {form.type === 'link' && (
          <BottomSheetField label="Web URL">
            <input 
              type="url" 
              placeholder="https://drive.google.com/..." 
              value={form.urlOrReference} 
              onChange={e => setForm({...form, urlOrReference: e.target.value})} 
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-neutral border border-bd-subtle text-xs text-tx-primary outline-none" 
            />
          </BottomSheetField>
        )}

        {form.type === 'note' && (
          <BottomSheetField label="Specification Content">
            <textarea 
              placeholder="Write your note here..." 
              value={form.urlOrReference} 
              onChange={e => setForm({...form, urlOrReference: e.target.value})} 
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-neutral border border-bd-subtle text-xs text-tx-primary outline-none h-28 resize-none" 
            />
          </BottomSheetField>
        )}

        <BottomSheetField label="Description (Optional)">
          <textarea 
            placeholder="Context, version notes, or usage instructions..." 
            value={form.description || ''} 
            onChange={e => setForm({...form, description: e.target.value})} 
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-neutral border border-bd-subtle text-xs text-tx-primary outline-none h-16 resize-none" 
          />
        </BottomSheetField>
        
        <div className="grid grid-cols-2 gap-3">
          <BottomSheetField label="Category">
            <select 
              value={form.category} 
              onChange={e => setForm({...form, category: e.target.value as any})} 
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-neutral border border-bd-subtle text-xs text-tx-primary outline-none"
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </BottomSheetField>
          <BottomSheetField label="Tags (comma separated)">
            <input 
              type="text" 
              placeholder="e.g. permitting, dwg" 
              value={form.tags?.join(', ') || ''} 
              onChange={e => setForm({...form, tags: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} 
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-neutral border border-bd-subtle text-xs text-tx-primary outline-none" 
            />
          </BottomSheetField>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <BottomSheetField label="Link Project">
            <SearchPicker 
              items={projects.map(p => ({ id: p.id, label: p.name }))} 
              value={form.projectId || ''} 
              onChange={(id) => {
                const proj = projects.find(p => p.id === id);
                setForm({ ...form, projectId: id, clientId: proj?.clientId || form.clientId });
              }} 
            />
          </BottomSheetField>

          <BottomSheetField label="Link Client">
            <SearchPicker 
              items={clients.map(c => ({ id: c.id, label: c.name }))} 
              value={form.clientId || ''} 
              onChange={(id) => setForm({...form, clientId: id})} 
            />
          </BottomSheetField>
        </div>
      </BottomSheet>

      {/* Action Menu */}
      <BottomSheet 
        isOpen={!!actionItem && !isDeleteConfirmOpen} 
        onClose={() => setActionItem(null)} 
        title="Resource Options"
      >
        <div className="space-y-1 py-1">
          <button 
            onClick={() => { setPreviewItem(actionItem); setActionItem(null); }} 
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-neutral rounded-xl transition-colors"
          >
            <FileText size={16} className="text-tx-primary" />
            <span className="text-xs font-semibold text-tx-primary">Open & Preview</span>
          </button>

          {/* Schedule Review cross-link */}
          <button 
            onClick={() => {
              const item = actionItem!;
              setActionItem(null);
              push('calendar', { 
                filterProjectId: item.projectId, 
                clientId: item.clientId 
              });
            }} 
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-neutral rounded-xl transition-colors"
          >
            <Calendar size={16} className="text-accent-primary" />
            <span className="text-xs font-semibold text-tx-primary">Schedule Review in Calendar</span>
          </button>

          {/* Jump to Project */}
          {actionItem?.projectId && (
            <button 
              onClick={() => {
                const pId = actionItem.projectId!;
                setActionItem(null);
                goToTab('projects', { filterProjectId: pId });
              }} 
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-neutral rounded-xl transition-colors"
            >
              <FolderKanban size={16} className="text-accent-secondary" />
              <span className="text-xs font-semibold text-tx-primary">Go to Project Workspace</span>
            </button>
          )}

          {/* Favorite */}
          <button 
            onClick={() => { 
              updateLibraryItem(actionItem!.id, { isFavorite: !actionItem!.isFavorite }); 
              setActionItem(null); 
            }} 
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-neutral rounded-xl transition-colors"
          >
            <Star size={16} className={actionItem?.isFavorite ? "fill-accent-primary text-accent-primary" : "text-tx-primary"} />
            <span className="text-xs font-semibold text-tx-primary">{actionItem?.isFavorite ? 'Remove Favorite' : 'Mark as Favorite'}</span>
          </button>

          {/* Safe Download */}
          {(actionItem?.type === 'file' || actionItem?.type === 'link') && (
            <button 
              onClick={() => handleDownload(actionItem!)} 
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-neutral rounded-xl transition-colors"
            >
              <Download size={16} className="text-tx-primary" />
              <span className="text-xs font-semibold text-tx-primary">{actionItem?.type === 'file' ? 'Download Secure File' : 'Open Link'}</span>
            </button>
          )}

          <button 
            onClick={() => handleShare(actionItem!)} 
            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-neutral rounded-xl transition-colors"
          >
            <Share2 size={16} className="text-tx-primary" />
            <span className="text-xs font-semibold text-tx-primary">Share Reference</span>
          </button>

          {!isReadOnly && (
            <>
              <button 
                onClick={() => handleOpenForm(actionItem!.type, actionItem!)} 
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-neutral rounded-xl transition-colors"
              >
                <Edit size={16} className="text-tx-primary" />
                <span className="text-xs font-semibold text-tx-primary">Edit Metadata</span>
              </button>
              <button 
                onClick={() => setDeleteConfirmOpen(true)} 
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-red-500/10 rounded-xl transition-colors"
              >
                <Trash2 size={16} className="text-red-500" />
                <span className="text-xs font-semibold text-red-500">Delete Resource</span>
              </button>
            </>
          )}
        </div>
      </BottomSheet>

      {/* Honest Storage Architecture Modal */}
      <BottomSheet
        isOpen={isStorageModalOpen}
        onClose={() => setIsStorageModalOpen(false)}
        title="File Storage & Security Architecture"
      >
        <div className="space-y-4 py-2">
          <div className="p-3.5 bg-surface-neutral/80 rounded-2xl border border-bd-subtle space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-tx-primary">
              <HardDrive size={16} className="text-accent-primary shrink-0" />
              <span>Protected Organization Storage Volume</span>
            </div>
            <p className="text-xs text-tx-muted leading-relaxed">
              Files uploaded to MenkR- are stored on an isolated company volume in PostgreSQL and encrypted disk storage with SHA-256 verification and role-based permissions.
            </p>
          </div>

          <div className="space-y-2 text-xs text-tx-secondary">
            <div className="flex justify-between py-1.5 border-b border-bd-subtle">
              <span className="text-tx-muted">Max File Size</span>
              <span className="font-semibold text-tx-primary">10 MB</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-bd-subtle">
              <span className="text-tx-muted">Cloud S3 / GCS Sync</span>
              <span className="font-semibold text-amber-500">Not Configured (Local Mode)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-bd-subtle">
              <span className="text-tx-muted">Access Control</span>
              <span className="font-semibold text-tx-primary">Organization Scoped (Viewer / Member)</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-tx-muted">Dangerous File Filtering</span>
              <span className="font-semibold text-accent-secondary">Enforced (.exe, .sh, etc. blocked)</span>
            </div>
          </div>
        </div>
      </BottomSheet>

      {/* Preview Panel */}
      {previewItem && (
        <div className="absolute inset-0 bg-canvas z-50 flex flex-col h-full animate-in slide-in-from-bottom-4">
          <Header 
            title={previewItem.name}
            leftIcon={<IconButton variant="ghost" onClick={() => setPreviewItem(null)} className="-ml-2"><ChevronLeft size={24} /></IconButton>}
            rightIcon={
               <div className="flex gap-1">
                 <IconButton variant="ghost" onClick={() => handleDownload(previewItem)}><Download size={20} /></IconButton>
               </div>
            }
          />
          <div className="flex-1 overflow-y-auto bg-surface-neutral/20 p-4 md:p-8">
            <div className="max-w-4xl mx-auto bg-canvas rounded-2xl border border-bd-subtle overflow-hidden shadow-xs flex flex-col h-full min-h-[60vh]">
              {previewItem.type === 'file' && previewItem.mimeType?.startsWith('image/') ? (
                <div className="flex-1 p-4 flex items-center justify-center bg-surface-neutral/30">
                  <img src={previewItem.urlOrReference} alt={previewItem.name} className="max-w-full max-h-[65vh] object-contain rounded-lg" />
                </div>
              ) : previewItem.type === 'file' && previewItem.urlOrReference?.startsWith('data:application/pdf') ? (
                <div className="flex-1">
                  <iframe src={previewItem.urlOrReference} className="w-full h-full min-h-[65vh] border-none" title={previewItem.name} />
                </div>
              ) : previewItem.type === 'note' ? (
                <div className="flex-1 p-6 md:p-10 prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap leading-relaxed text-tx-primary text-sm">{previewItem.urlOrReference}</div>
                </div>
              ) : previewItem.type === 'link' ? (
                <div className="flex-1 p-10 flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 mb-3">
                    <Link2 size={28} />
                  </div>
                  <h3 className="text-base font-bold text-tx-primary mb-1">External Web Resource</h3>
                  <a href={previewItem.urlOrReference} target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline text-xs font-semibold break-all max-w-md">
                    {previewItem.urlOrReference}
                  </a>
                </div>
              ) : (
                <div className="flex-1 p-10 flex flex-col items-center justify-center text-center">
                  <div className="w-14 h-14 bg-surface-neutral rounded-2xl flex items-center justify-center text-tx-muted mb-3">
                    <File size={28} />
                  </div>
                  <h3 className="text-base font-bold text-tx-primary mb-1">Protected Stored File</h3>
                  <p className="text-xs text-tx-muted mb-4">Click download to retrieve and view with your device's native viewer.</p>
                  <Button onClick={() => handleDownload(previewItem)}>Download File</Button>
                </div>
              )}
              
              {/* Metadata & Quick Cross-Actions */}
              <div className="p-4 md:p-6 border-t border-bd-subtle bg-canvas shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-tx-muted uppercase tracking-wider">Resource Context</h4>
                  <div className="flex items-center gap-2">
                    {previewItem.projectId && (
                      <button 
                        onClick={() => {
                          const pId = previewItem.projectId!;
                          setPreviewItem(null);
                          goToTab('projects', { filterProjectId: pId });
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-neutral hover:bg-surface-neutral/80 rounded-lg text-xs font-semibold text-tx-primary"
                      >
                        <FolderKanban size={13} className="text-accent-primary" />
                        <span>Project Workspace</span>
                        <ArrowUpRight size={11} className="opacity-60" />
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        const item = previewItem;
                        setPreviewItem(null);
                        push('calendar', { filterProjectId: item.projectId, clientId: item.clientId });
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-surface-neutral hover:bg-surface-neutral/80 rounded-lg text-xs font-semibold text-tx-primary"
                    >
                      <Calendar size={13} className="text-accent-secondary" />
                      <span>Schedule Review</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="block text-tx-muted mb-0.5">Category</span>
                    <Badge variant="outline">{previewItem.category}</Badge>
                  </div>
                  <div>
                    <span className="block text-tx-muted mb-0.5">Type</span>
                    <span className="capitalize text-tx-primary font-semibold">{previewItem.type}</span>
                  </div>
                  {previewItem.size && (
                    <div>
                      <span className="block text-tx-muted mb-0.5">Size</span>
                      <span className="text-tx-primary font-semibold">{(previewItem.size / 1024).toFixed(1)} KB</span>
                    </div>
                  )}
                  <div>
                    <span className="block text-tx-muted mb-0.5">Created</span>
                    <span className="text-tx-primary font-semibold">{new Date(previewItem.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setActionItem(null);
        }}
        onConfirm={() => {
          if (actionItem) {
            deleteLibraryItem(actionItem.id);
            setDeleteConfirmOpen(false);
            setActionItem(null);
            showToast({ message: 'Resource removed from library' });
          }
        }}
        title="Delete Resource"
        body={`Permanently delete "${actionItem?.name}"? This file will be unlinked from projects and schedules.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
