import React, { useState, useMemo, useRef } from 'react';
import { Header } from '../components/Shared';
import { useLibrary } from '../context/LibraryContext';
import { useClients } from '../context/ClientsContext';
import { useProjects } from '../context/ProjectsContext';
import { useNavigation } from '../context/NavigationContext';
import { useToast } from '../context/ToastContext';
import { EmptyState, Button, IconButton, Badge } from '../components/ui';
import { BottomSheet, BottomSheetField } from '../components/BottomSheet';
import { SearchPicker } from '../components/SearchPicker';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { 
  FolderHeart, Plus, ChevronLeft, Search, Filter, MoreVertical, 
  FileText, Link2, FileImage, File, Star, Download, Trash2, Edit, Share2
} from 'lucide-react';
import { LibraryItem, LibraryCategory } from '../types';

export function Library({ onDismiss }: { onDismiss: () => void }) {
  const { library, addLibraryItem, updateLibraryItem, deleteLibraryItem } = useLibrary();
  const { clients } = useClients();
  const { projects } = useProjects();
  const { navigationOptions } = useNavigation();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<LibraryCategory | 'All'>('All');
      const [filterType, setFilterType] = useState<'all' | 'file' | 'link' | 'note'>('all');
  const [filterClientId, setFilterClientId] = useState('');
  const [filterProjectId, setFilterProjectId] = useState(navigationOptions?.filterProjectId || '');
  const [filterTaskId, setFilterTaskId] = useState(navigationOptions?.filterTaskId || '');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [isFilterPanelOpen, setFilterPanelOpen] = useState(false);

  const [isAddMenuOpen, setAddMenuOpen] = useState(false);
  
  const [isItemFormOpen, setItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);
  
  const defaultForm: Partial<LibraryItem> = {
    name: '',
    type: 'file',
    category: 'Documents',
    urlOrReference: '',
    tags: [],
    clientId: '',
    projectId: ''
  };
  const [form, setForm] = useState<Partial<LibraryItem>>(defaultForm);

  const [actionItem, setActionItem] = useState<LibraryItem | null>(null);
  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<LibraryItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setAddMenuOpen(false);
    if (item) {
      setEditingItem(item);
      setForm({ ...item });
    } else {
      setEditingItem(null);
      setForm({ ...defaultForm, type });
    }
    setItemFormOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast({ message: "File is too large for local preview storage. Please choose a file smaller than 2MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setForm(prev => ({
        ...prev,
        name: prev.name || file.name,
        size: file.size,
        mimeType: file.type,
        urlOrReference: event.target?.result as string,
        type: 'file'
      }));
    };
    reader.onerror = () => {
      showToast({ message: "Error reading file." });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!form.name?.trim()) return;
    
    if (editingItem) {
      updateLibraryItem(editingItem.id, form);
    } else {
      addLibraryItem({
        name: form.name,
        type: form.type as any,
        category: form.category as any,
        urlOrReference: form.urlOrReference || '',
        size: form.size,
        mimeType: form.mimeType,
        description: form.description,
        clientId: form.clientId,
        projectId: form.projectId,
        tags: form.tags || [],
        isFavorite: false
      });
    }
    setItemFormOpen(false);
  };

  const handleDownload = (item: LibraryItem) => {
    if (item.type !== 'file' || !item.urlOrReference.startsWith('data:')) {
      window.open(item.urlOrReference, '_blank');
      return;
    }
    const a = document.createElement('a');
    a.href = item.urlOrReference;
    a.download = item.name;
    a.click();
    setActionItem(null);
  };

  const handleShare = async (item: LibraryItem) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: item.name,
          text: item.description || `Check out this ${item.type} from MenkiR`,
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
    if (type === 'link') return <Link2 size={24} className="text-blue-500" />;
    if (type === 'note') return <FileText size={24} className="text-amber-500" />;
    if (mimeType?.startsWith('image/')) return <FileImage size={24} className="text-green-500" />;
    return <File size={24} className="text-tx-muted" />;
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
          <IconButton variant="primary" onClick={() => setAddMenuOpen(true)}>
            <Plus size={20} />
          </IconButton>
        } 
      />

      <div className="px-4 py-3 md:px-8 bg-canvas border-b border-bd-subtle flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted" />
          <input 
            type="text" 
            placeholder="Search files, links, notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-neutral rounded-full text-[15px] outline-none text-tx-primary"
          />
        </div>
        <IconButton variant={filterClientId || filterProjectId || filterType !== 'all' ? 'primary' : 'secondary'} className="shrink-0" onClick={() => setFilterPanelOpen(true)}>
          <Filter size={20} />
        </IconButton>
        <div className="flex gap-2 overflow-x-auto no-scrollbar shrink-0 pb-1">
           <button
             onClick={() => setFilterCategory('All')}
             className={`px-4 py-2 rounded-full text-[14px] font-medium whitespace-nowrap transition-colors ${filterCategory === 'All' ? 'bg-tx-primary text-canvas' : 'bg-surface-neutral text-tx-primary'}`}
           >
             All Categories
           </button>
           {categories.map(c => (
             <button
               key={c}
               onClick={() => setFilterCategory(c)}
               className={`px-4 py-2 rounded-full text-[14px] font-medium whitespace-nowrap transition-colors ${filterCategory === c ? 'bg-tx-primary text-canvas' : 'bg-surface-neutral text-tx-primary'}`}
             >
               {c}
             </button>
           ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
        {filteredLibrary.length === 0 ? (
          <EmptyState 
            icon={<FolderHeart size={32} />}
            title="No Items Found"
            description="Store documents, links, and project assets here."
            action={<Button onClick={() => setAddMenuOpen(true)}>Add New</Button>}
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredLibrary.map(l => (
              <div 
                key={l.id} 
                onClick={() => setPreviewItem(l)}
                className="group flex flex-col p-4 bg-surface-neutral/30 rounded-2xl border border-bd-subtle cursor-pointer hover:border-accent-primary/50 transition-colors"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="w-10 h-10 rounded-xl bg-canvas border border-bd-subtle flex items-center justify-center shrink-0">
                    {renderIcon(l.type, l.mimeType)}
                  </div>
                  <IconButton variant="ghost" size="sm" className="-mt-2 -mr-2 opacity-0 group-hover:opacity-100 md:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); setActionItem(l); }}>
                    <MoreVertical size={16} />
                  </IconButton>
                </div>
                
                <h3 className="font-semibold text-[14px] text-tx-primary line-clamp-2 leading-tight mb-1" title={l.name}>{l.name}</h3>
                
                <div className="mt-auto pt-3 flex items-center justify-between">
                  <span className="text-[11px] text-tx-muted font-medium">{l.category}</span>
                  {l.isFavorite && <Star size={12} className="fill-accent-primary text-accent-primary" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Menu */}
      <BottomSheet isOpen={isAddMenuOpen} onClose={() => setAddMenuOpen(false)} title="Add to Library">
        <div className="grid grid-cols-3 gap-4 py-4">
          <button onClick={() => handleOpenForm('file')} className="flex flex-col items-center gap-2 p-4 bg-surface-neutral/50 rounded-xl border border-bd-subtle hover:border-accent-primary/50">
            <File size={24} className="text-tx-primary" />
            <span className="text-[13px] font-medium text-tx-primary">File</span>
          </button>
          <button onClick={() => handleOpenForm('link')} className="flex flex-col items-center gap-2 p-4 bg-surface-neutral/50 rounded-xl border border-bd-subtle hover:border-accent-primary/50">
            <Link2 size={24} className="text-tx-primary" />
            <span className="text-[13px] font-medium text-tx-primary">Link</span>
          </button>
          <button onClick={() => handleOpenForm('note')} className="flex flex-col items-center gap-2 p-4 bg-surface-neutral/50 rounded-xl border border-bd-subtle hover:border-accent-primary/50">
            <FileText size={24} className="text-tx-primary" />
            <span className="text-[13px] font-medium text-tx-primary">Note</span>
          </button>
        </div>
      </BottomSheet>


      {/* Filter Panel */}
      <BottomSheet isOpen={isFilterPanelOpen} onClose={() => setFilterPanelOpen(false)} title="Filters">
        <BottomSheetField label="Type">
          <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary">
            <option value="all">All Types</option>
            <option value="file">Files</option>
            <option value="link">Links</option>
            <option value="note">Notes</option>
          </select>
        </BottomSheetField>
        
        <BottomSheetField label="Client">
          <SearchPicker items={[{ id: '', label: 'All Clients' }, ...clients.map(c => ({ id: c.id, label: c.name }))]} value={filterClientId} onChange={setFilterClientId} />
        </BottomSheetField>
        
        <BottomSheetField label="Project">
          <SearchPicker items={[{ id: '', label: 'All Projects' }, ...projects.map(p => ({ id: p.id, label: p.name }))]} value={filterProjectId} onChange={setFilterProjectId} />
        </BottomSheetField>
        
        <BottomSheetField label="Date Sort">
          <select value={sortOrder} onChange={e => setSortOrder(e.target.value as any)} className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary">
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </BottomSheetField>
        
        <div className="pt-4">
          <Button variant="primary" className="w-full" onClick={() => setFilterPanelOpen(false)}>Apply Filters</Button>
        </div>
      </BottomSheet>

      {/* Item Form */}
      <BottomSheet isOpen={isItemFormOpen} onClose={() => setItemFormOpen(false)} title={editingItem ? "Edit Item" : `New ${form.type === 'file' ? 'File' : form.type === 'link' ? 'Link' : 'Note'}`} onSave={handleSave}>
        
        {form.type === 'file' && !editingItem && (
           <div className="mb-4">
             <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
             <Button variant="secondary" className="w-full border-dashed" onClick={() => fileInputRef.current?.click()}>
               {form.urlOrReference ? 'Change File' : 'Select File (Max 2MB)'}
             </Button>
           </div>
        )}

        <BottomSheetField>
          <input type="text" placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full text-[20px] font-medium text-tx-primary placeholder:text-tx-muted/50 bg-transparent outline-none py-2" />
        </BottomSheetField>
        
        {form.type === 'link' && (
          <BottomSheetField label="URL">
            <input type="url" placeholder="https://" value={form.urlOrReference} onChange={e => setForm({...form, urlOrReference: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary" />
          </BottomSheetField>
        )}

        {form.type === 'note' && (
          <BottomSheetField label="Content">
            <textarea placeholder="Write your note here..." value={form.urlOrReference} onChange={e => setForm({...form, urlOrReference: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary h-32 resize-none" />
          </BottomSheetField>
        )}

                <BottomSheetField label="Description (Optional)">
          <textarea placeholder="Add a description..." value={form.description || ''} onChange={e => setForm({...form, description: e.target.value})} className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary h-24 resize-none" />
        </BottomSheetField>
        
        <div className="grid grid-cols-2 gap-4">
          <BottomSheetField label="Category">
            <select value={form.category} onChange={e => setForm({...form, category: e.target.value as any})} className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary">
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </BottomSheetField>
          <BottomSheetField label="Tags (comma separated)">
             <input type="text" placeholder="e.g. contracts" value={form.tags?.join(', ') || ''} onChange={e => setForm({...form, tags: e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary" />
          </BottomSheetField>
        </div>

        <BottomSheetField label="Associate with Client (Optional)">
          <SearchPicker items={clients.map(c => ({ id: c.id, label: c.name }))} value={form.clientId || ''} onChange={(id) => setForm({...form, clientId: id})} />
        </BottomSheetField>

        <BottomSheetField label="Associate with Project (Optional)">
          <SearchPicker items={projects.map(p => ({ id: p.id, label: p.name }))} value={form.projectId || ''} onChange={(id) => setForm({...form, projectId: id})} />
        </BottomSheetField>

      </BottomSheet>

      {/* Action Menu */}
      <BottomSheet isOpen={!!actionItem && !isDeleteConfirmOpen} onClose={() => setActionItem(null)} title="Options">
        <div className="space-y-1 py-2">
          <button onClick={() => { setActionItem(null); setPreviewItem(actionItem); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-neutral rounded-xl transition-colors">
            <FileText size={18} className="text-tx-primary" />
            <span className="text-[15px] font-medium text-tx-primary">Open / Preview</span>
          </button>
          <button onClick={() => { updateLibraryItem(actionItem!.id, { isFavorite: !actionItem!.isFavorite }); setActionItem(null); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-neutral rounded-xl transition-colors">
            <Star size={18} className={actionItem?.isFavorite ? "fill-accent-primary text-accent-primary" : "text-tx-primary"} />
            <span className="text-[15px] font-medium text-tx-primary">{actionItem?.isFavorite ? 'Remove Favorite' : 'Add to Favorites'}</span>
          </button>
          {(actionItem?.type === 'file' || actionItem?.type === 'link') && (
            <button onClick={() => handleDownload(actionItem!)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-neutral rounded-xl transition-colors">
              <Download size={18} className="text-tx-primary" />
              <span className="text-[15px] font-medium text-tx-primary">{actionItem?.type === 'file' ? 'Download' : 'Open Link'}</span>
            </button>
          )}
          <button onClick={() => handleShare(actionItem!)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-neutral rounded-xl transition-colors">
            <Share2 size={18} className="text-tx-primary" />
            <span className="text-[15px] font-medium text-tx-primary">Share</span>
          </button>
          <button onClick={() => handleOpenForm(actionItem!.type, actionItem!)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-neutral rounded-xl transition-colors">
            <Edit size={18} className="text-tx-primary" />
            <span className="text-[15px] font-medium text-tx-primary">Edit Metadata</span>
          </button>
          <button onClick={() => setDeleteConfirmOpen(true)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-red-500/10 rounded-xl transition-colors">
            <Trash2 size={18} className="text-red-500" />
            <span className="text-[15px] font-medium text-red-500">Delete Item</span>
          </button>
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
            <div className="max-w-4xl mx-auto bg-canvas rounded-2xl border border-bd-subtle overflow-hidden shadow-sm flex flex-col h-full min-h-[60vh]">
              {previewItem.type === 'file' && previewItem.mimeType?.startsWith('image/') ? (
                <div className="flex-1 p-4 flex items-center justify-center bg-surface-neutral/30">
                  <img src={previewItem.urlOrReference} alt={previewItem.name} className="max-w-full max-h-[70vh] object-contain rounded-lg" />
                </div>
              ) : previewItem.type === 'file' && previewItem.urlOrReference.startsWith('data:application/pdf') ? (
                <div className="flex-1">
                  <iframe src={previewItem.urlOrReference} className="w-full h-full min-h-[70vh] border-none" title={previewItem.name} />
                </div>
              ) : previewItem.type === 'note' ? (
                <div className="flex-1 p-6 md:p-10 prose prose-sm md:prose-base max-w-none dark:prose-invert">
                   <div className="whitespace-pre-wrap font-serif leading-relaxed text-tx-primary">{previewItem.urlOrReference}</div>
                </div>
              ) : previewItem.type === 'link' ? (
                <div className="flex-1 p-10 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500 mb-4">
                    <Link2 size={32} />
                  </div>
                  <h3 className="text-xl font-semibold text-tx-primary mb-2">External Link</h3>
                  <a href={previewItem.urlOrReference} target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline font-medium break-all max-w-xl">
                    {previewItem.urlOrReference}
                  </a>
                </div>
              ) : (
                <div className="flex-1 p-10 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-surface-neutral rounded-full flex items-center justify-center text-tx-muted mb-4">
                    <File size={32} />
                  </div>
                  <h3 className="text-lg font-semibold text-tx-primary mb-2">No Preview Available</h3>
                  <p className="text-tx-muted mb-6">This file type cannot be previewed natively.</p>
                  <Button onClick={() => handleDownload(previewItem)}>Download to View</Button>
                </div>
              )}
              
              <div className="p-4 md:p-6 border-t border-bd-subtle bg-canvas shrink-0">
                <h4 className="font-semibold text-tx-primary mb-2">Metadata</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[13px]">
                  <div>
                    <span className="block text-tx-muted mb-1">Category</span>
                    <Badge variant="outline">{previewItem.category}</Badge>
                  </div>
                  <div>
                    <span className="block text-tx-muted mb-1">Type</span>
                    <span className="capitalize text-tx-primary font-medium">{previewItem.type}</span>
                  </div>
                  {previewItem.size && (
                    <div>
                      <span className="block text-tx-muted mb-1">Size</span>
                      <span className="text-tx-primary font-medium">{(previewItem.size / 1024).toFixed(1)} KB</span>
                    </div>
                  )}
                  <div>
                    <span className="block text-tx-muted mb-1">Created</span>
                    <span className="text-tx-primary font-medium">{new Date(previewItem.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                {previewItem.tags.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-bd-subtle">
                    <span className="block text-tx-muted text-[13px] mb-2">Tags</span>
                    <div className="flex flex-wrap gap-2">
                      {previewItem.tags.map(t => (
                        <span key={t} className="px-2 py-1 bg-surface-neutral rounded text-[11px] font-medium text-tx-primary">#{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
          }
        }}
        title="Delete Item"
        body="Are you sure you want to delete this item? This action cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
