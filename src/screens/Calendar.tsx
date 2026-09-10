import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Search, MoreVertical, Calendar as CalendarIcon, Clock, CheckSquare, Users, FolderKanban, Link as LinkIcon, MapPin, Layout } from 'lucide-react';
import { Header } from '../components/Shared';
import { BottomSheet, BottomSheetField } from '../components/BottomSheet';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SearchPicker } from '../components/SearchPicker';
import { useCalendar } from '../context/CalendarContext';
import { useClients } from '../context/ClientsContext';
import { useProjects } from '../context/ProjectsContext';
import { useTasks } from '../context/TasksContext';
import { useNavigation } from '../context/NavigationContext';
import { useTimeTracker } from '../context/TimeTrackerContext';
import { EventItem, EventType, EventStatus } from '../types';
import { generateId } from '../utils/id';
import { Button, IconButton, Tabs, Badge, EmptyState } from '../components/ui';

export function Calendar({ onDismiss }: { onDismiss?: () => void }) {
  const { events, addEvent, updateEvent, deleteEvent } = useCalendar();
  const { startTimerFor } = useTimeTracker();
  const { clients } = useClients();
  const { projects } = useProjects();
  const { tasks } = useTasks();
  const { navigationOptions, push, goToTab } = useNavigation();
  
  const filterProjectId = navigationOptions?.filterProjectId || '';
  const filterTaskId = navigationOptions?.filterTaskId || '';
  const filterClientId = navigationOptions?.filterClientId || '';

  const [view, setView] = useState<'day' | 'week' | 'month' | 'agenda'>('agenda');
  const [currentDate, setCurrentDate] = useState(new Date());

  const [isSheetOpen, setSheetOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const matchProject = filterProjectId ? e.projectId === filterProjectId : true;
      const matchTask = filterTaskId ? e.taskId === filterTaskId : true;
      const matchClient = filterClientId ? e.clientId === filterClientId : true;
      return matchProject && matchTask && matchClient;
    });
  }, [events, filterProjectId, filterTaskId, filterClientId]);

  // Use filteredEvents instead of events for the views
  const displayEvents = filteredEvents;

  const [isDeleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const defaultForm: Omit<EventItem, 'id' | 'createdAt' | 'updatedAt'> = {
    title: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
    duration: 60,
    allDay: false,
    type: 'Meeting',
    status: 'scheduled',
    repeat: 'None',
    categoryId: '',
    notes: '',
  };

  const [form, setForm] = useState(defaultForm);
  const [showMoreDetails, setShowMoreDetails] = useState(false);

  const handleOpenSheet = (event?: EventItem) => {
    if (event) {
      setEditingEvent(event);
      setForm({ ...event });
      setShowMoreDetails(true);
    } else {
      setEditingEvent(null);
      setForm({ ...defaultForm, date: currentDate.toISOString().split('T')[0] });
      setShowMoreDetails(false);
    }
    setSheetOpen(true);
  };

  const handleSave = () => {
    if (!form.title.trim()) return;
    
    if (editingEvent) {
      updateEvent(editingEvent.id, form);
    } else {
      addEvent(form);
    }
    setSheetOpen(false);
  };

  // Date Math
  const handlePrev = () => {
    const next = new Date(currentDate);
    if (view === 'month') next.setMonth(next.getMonth() - 1);
    else if (view === 'week') next.setDate(next.getDate() - 7);
    else next.setDate(next.getDate() - 1);
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (view === 'month') next.setMonth(next.getMonth() + 1);
    else if (view === 'week') next.setDate(next.getDate() + 7);
    else next.setDate(next.getDate() + 1);
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Filter events by date range
  const visibleEvents = useMemo(() => {
    if (view === 'agenda') {
      const today = new Date().toISOString().split('T')[0];
      return events
        .filter(e => e.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));
    }
    
    // Day view
    if (view === 'day') {
      const dateStr = currentDate.toISOString().split('T')[0];
      return events.filter(e => e.date === dateStr).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
    }

    // Weak / Month omitted for brevity, but we can do a simple version
    return events;
  }, [events, view, currentDate]);

  return (
    <div className="flex flex-col h-full bg-canvas relative">
      <header className="px-4 pt-12 pb-4 md:pt-8 border-b border-bd-subtle shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {onDismiss && (
              <IconButton variant="ghost" onClick={onDismiss} className="md:hidden -ml-2">
                <ChevronLeft size={24} />
              </IconButton>
            )}
            <h1 className="text-2xl font-bold text-tx-primary">Schedule</h1>
          </div>
          <div className="flex items-center gap-2">
            <IconButton variant="secondary" onClick={() => handleToday()} className="hidden md:flex">
              <span className="text-sm font-medium">Today</span>
            </IconButton>
            <IconButton variant="primary" onClick={() => handleOpenSheet()}>
              <Plus size={20} />
            </IconButton>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <Tabs 
            tabs={[
              { id: 'day', label: 'Day' },
              { id: 'week', label: 'Week' },
              { id: 'month', label: 'Month' },
              { id: 'agenda', label: 'Agenda' }
            ]} 
            activeTab={view} 
            onChange={(v) => setView(v as any)} 
            className="w-full md:w-auto"
          />
          <div className="flex items-center justify-between gap-4">
            <span className="text-[15px] font-semibold text-tx-primary">
              {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <div className="flex items-center gap-1">
              <IconButton variant="ghost" size="sm" onClick={handlePrev}><ChevronLeft size={18} /></IconButton>
              <IconButton variant="ghost" size="sm" onClick={handleNext}><ChevronRight size={18} /></IconButton>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 no-scrollbar">
        {view === 'agenda' && (
          <div className="space-y-6">
            {visibleEvents.length === 0 ? (
              <EmptyState 
                icon={<CalendarIcon size={32} />} 
                title="No Upcoming Events" 
                description="Your schedule is clear. Create a new event or task block." 
                action={<Button onClick={() => handleOpenSheet()}>Create Event</Button>} 
              />
            ) : (
              visibleEvents.map(event => (
                <div key={event.id} onClick={() => handleOpenSheet(event)} className="flex items-start gap-4 p-4 rounded-2xl bg-surface-neutral/30 border border-bd-subtle hover:border-accent-primary/50 cursor-pointer transition-colors">
                  <div className="w-16 text-center shrink-0">
                    <div className="text-sm font-semibold text-tx-primary">{event.allDay ? 'All Day' : event.startTime}</div>
                    {!event.allDay && <div className="text-xs text-tx-muted">{event.endTime}</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-tx-primary truncate">{event.title}</h3>
                      <Badge variant={event.status === 'completed' ? 'success' : 'outline'}>{event.type}</Badge>
                    </div>
                    {event.notes && <p className="text-sm text-tx-muted line-clamp-2 mb-2">{event.notes}</p>}
                    
                    {/* Meta info tags */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {event.clientId && (
                        <div className="flex items-center gap-1 text-xs px-2 py-1 bg-surface-neutral rounded-md text-tx-secondary">
                          <Users size={12} />
                          <span className="truncate max-w-[100px]">{clients.find(c => c.id === event.clientId)?.name || 'Client'}</span>
                        </div>
                      )}
                      {event.projectId && (
                        <div className="flex items-center gap-1 text-xs px-2 py-1 bg-surface-neutral rounded-md text-tx-secondary">
                          <FolderKanban size={12} />
                          <span className="truncate max-w-[100px]">{projects.find(p => p.id === event.projectId)?.name || 'Project'}</span>
                        </div>
                      )}
                      {event.taskId && (
                        <div className="flex items-center gap-1 text-xs px-2 py-1 bg-surface-neutral rounded-md text-tx-secondary">
                          <CheckSquare size={12} />
                          <span className="truncate max-w-[100px]">{tasks.find(t => t.id === event.taskId)?.title || 'Task'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        
        {view === 'day' && (
          <div className="space-y-4">
             {visibleEvents.length === 0 ? (
               <div className="text-center py-12 text-tx-muted">No events scheduled for this day.</div>
             ) : (
                visibleEvents.map(event => (
                  <div key={event.id} onClick={() => handleOpenSheet(event)} className="flex items-start gap-4 p-4 rounded-xl border border-bd-subtle bg-surface-neutral/10 cursor-pointer">
                    <div className="w-16 shrink-0 text-sm font-semibold text-tx-primary">{event.allDay ? 'All Day' : event.startTime}</div>
                    <div>
                      <h3 className="font-semibold text-tx-primary">{event.title}</h3>
                      <p className="text-sm text-tx-muted">{event.type}</p>
                    </div>
                  </div>
                ))
             )}
          </div>
        )}

        
        {view === 'month' && (
          <div className="space-y-4">
            <div className="grid grid-cols-7 mb-2 text-center text-[13px] font-medium text-tx-muted">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1 md:gap-2 text-center">
              {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() }).map((_, i) => (
                <div key={`empty-${i}`} className="h-16 md:h-24 bg-canvas border border-transparent rounded-lg"></div>
              ))}
              {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() }).map((_, i) => {
                const dateNum = i + 1;
                const dStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(dateNum).padStart(2, '0')}`;
                const hasEvents = events.filter(e => e.date === dStr);
                const isToday = dStr === new Date().toISOString().split('T')[0];
                return (
                  <div key={dateNum} onClick={() => { setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), dateNum)); setView('day'); }} className="h-16 md:h-24 flex flex-col p-1 bg-surface-neutral/10 border border-bd-subtle rounded-lg cursor-pointer hover:border-accent-primary/50 transition-colors overflow-hidden">
                    <div className={`text-xs font-semibold w-6 h-6 rounded-full flex items-center justify-center mb-1 ${isToday ? 'bg-accent-primary text-tx-primary' : 'text-tx-secondary'}`}>
                      {dateNum}
                    </div>
                    <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                      {hasEvents.slice(0, 2).map(e => (
                        <div key={e.id} className="text-[10px] md:text-xs text-left px-1.5 py-0.5 bg-canvas border border-bd-subtle rounded truncate text-tx-primary">
                          {e.title}
                        </div>
                      ))}
                      {hasEvents.length > 2 && <div className="text-[10px] text-tx-muted text-left px-1">+{hasEvents.length - 2}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === 'week' && (
          <div className="flex flex-col min-w-[600px] overflow-x-auto">
             <div className="grid grid-cols-7 border-b border-bd-subtle sticky top-0 bg-canvas z-10">
               {Array.from({ length: 7 }).map((_, i) => {
                 const curr = new Date(currentDate);
                 curr.setDate(curr.getDate() - curr.getDay() + i);
                 const dateStr = curr.toISOString().split('T')[0];
                 const isToday = dateStr === new Date().toISOString().split('T')[0];
                 return (
                   <div key={i} className="p-3 text-center border-r border-bd-subtle last:border-r-0">
                     <div className="text-xs text-tx-muted uppercase font-medium">{curr.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                     <div className={`text-lg font-semibold mt-1 w-8 h-8 mx-auto rounded-full flex items-center justify-center ${isToday ? 'bg-accent-primary text-tx-primary' : 'text-tx-primary'}`}>
                       {curr.getDate()}
                     </div>
                   </div>
                 );
               })}
             </div>
             <div className="grid grid-cols-7 min-h-[500px]">
               {Array.from({ length: 7 }).map((_, i) => {
                 const curr = new Date(currentDate);
                 curr.setDate(curr.getDate() - curr.getDay() + i);
                 const dateStr = curr.toISOString().split('T')[0];
                 const dayEvents = events.filter(e => e.date === dateStr).sort((a,b) => (a.startTime||'').localeCompare(b.startTime||''));
                 return (
                   <div key={i} className="border-r border-bd-subtle last:border-r-0 p-2 flex flex-col gap-2">
                     {dayEvents.map(e => (
                        <div key={e.id} onClick={() => handleOpenSheet(e)} className="p-2 bg-surface-neutral/30 border border-bd-subtle rounded-lg cursor-pointer hover:border-accent-primary/50 text-left">
                          <div className="text-[10px] font-semibold text-tx-muted mb-0.5">{e.allDay ? 'All Day' : e.startTime}</div>
                          <div className="text-xs font-medium text-tx-primary truncate">{e.title}</div>
                        </div>
                     ))}
                   </div>
                 );
               })}
             </div>
          </div>
        )}

      </div>

      <BottomSheet
        isOpen={isSheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editingEvent ? 'Edit Event' : 'New Event'}
        onSave={handleSave}
      >
        <BottomSheetField>
          <input
            type="text"
            placeholder="Event Title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full text-[20px] font-medium text-tx-primary placeholder:text-tx-muted/50 bg-transparent outline-none py-2"
            autoFocus
          />
        </BottomSheetField>
        
        <div className="grid grid-cols-2 gap-4">
          <BottomSheetField label="Type">
            <select 
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value as EventType })}
              className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary"
            >
              {['Meeting', 'Client Call', 'Focus Time', 'Deadline', 'Milestone', 'Task Block', 'Payment Deadline', 'Personal', 'Reminder'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </BottomSheetField>
          
          <BottomSheetField label="Status">
            <select 
              value={form.status}
              onChange={e => setForm({ ...form, status: e.target.value as EventStatus })}
              className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary capitalize"
            >
              {['scheduled', 'in-progress', 'completed', 'cancelled', 'rescheduled'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </BottomSheetField>
        </div>

        <BottomSheetField label="Date & Time">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-neutral">
              <span className="text-[15px] font-medium text-tx-primary">All-day</span>
              <button 
                onClick={() => setForm(f => ({ ...f, allDay: !f.allDay }))}
                className={`w-12 h-6 rounded-full transition-colors flex items-center p-1 ${form.allDay ? 'bg-tx-primary' : 'bg-canvas border border-bd-subtle'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-canvas transition-transform ${form.allDay ? 'translate-x-6' : 'translate-x-0 bg-tx-muted'}`} />
              </button>
            </div>
            
            <input 
              type="date" 
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
              className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary" 
            />
            
            {!form.allDay && (
              <div className="flex items-center gap-2">
                <input 
                  type="time" 
                  value={form.startTime || ''}
                  onChange={e => setForm({ ...form, startTime: e.target.value })}
                  className="flex-1 px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary" 
                />
                <span className="text-tx-muted">to</span>
                <input 
                  type="time" 
                  value={form.endTime || ''}
                  onChange={e => setForm({ ...form, endTime: e.target.value })}
                  className="flex-1 px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary" 
                />
              </div>
            )}
          </div>
        </BottomSheetField>

        {!showMoreDetails ? (
          <button onClick={() => setShowMoreDetails(true)} className="text-[14px] font-medium text-tx-muted py-2 text-left w-full">
            More options (Relationships, Links, Notes)...
          </button>
        ) : (
          <div className="space-y-6 mt-4">
            <div className="p-4 bg-surface-neutral/30 rounded-xl space-y-4 border border-bd-subtle">
              <h4 className="text-sm font-semibold text-tx-primary mb-2">Connections</h4>
              
              <BottomSheetField label="Link Client">
                <SearchPicker
                  items={clients.map(c => ({ id: c.id, label: c.name }))}
                  value={form.clientId}
                  onChange={(id) => setForm(f => ({ ...f, clientId: id }))}
                />
              </BottomSheetField>
              
              <BottomSheetField label="Link Project">
                <SearchPicker
                  items={projects.map(p => ({ id: p.id, label: p.name }))}
                  value={editingEvent.projectId}
                  onChange={(id) => setForm(f => ({ ...f, projectId: id }))}
                />
              </BottomSheetField>

              <BottomSheetField label="Link Task (Execute Task Block)">
                <SearchPicker
                  items={tasks.filter(t => t.status !== 'done').map(t => ({ id: t.id, label: t.title }))}
                  value={editingEvent.taskId}
                  onChange={(id) => setForm(f => ({ ...f, taskId: id }))}
                />
              </BottomSheetField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <BottomSheetField label="Location">
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted" />
                  <input type="text" placeholder="Add location" value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} className="w-full pl-9 pr-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary" />
                </div>
              </BottomSheetField>
              <BottomSheetField label="Meeting Link">
                <div className="relative">
                  <LinkIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tx-muted" />
                  <input type="url" placeholder="https://zoom.us/..." value={form.meetingLink || ''} onChange={e => setForm({ ...form, meetingLink: e.target.value })} className="w-full pl-9 pr-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary" />
                </div>
              </BottomSheetField>
            </div>

            <BottomSheetField label="Notes">
              <textarea 
                placeholder="Meeting agenda, preparation notes..." 
                value={form.notes || ''}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-surface-neutral border-none text-[15px] outline-none text-tx-primary h-24 resize-none" 
              />
            </BottomSheetField>

            {editingEvent && (
              <button 
                onClick={() => setDeleteConfirmOpen(true)}
                className="w-full py-3 mt-4 rounded-xl border border-red-500/20 text-red-500 font-medium text-[15px] hover:bg-red-500/10 transition-colors"
              >
                Delete Event
              </button>
            )}
          </div>
        )}
        {editingEvent && (
          <div className="pt-4 mt-4 border-t border-bd-subtle">
            <h4 className="text-[13px] font-bold text-tx-muted uppercase tracking-wider mb-3">Related</h4>
            <div className="grid grid-cols-2 gap-3">
              {editingEvent.projectId && (
                <button onClick={() => { setSheetOpen(false); goToTab('projects', { filterProjectId: editingEvent.projectId }); }} className="flex items-center gap-2 p-3 bg-surface-neutral/30 rounded-xl border border-bd-subtle hover:border-accent-primary/50 transition-colors">
                  <Layout size={16} className="text-tx-primary" />
                  <span className="text-[14px] font-medium text-tx-primary">Project</span>
                </button>
              )}
              {editingEvent.taskId && (
                <button onClick={() => { setSheetOpen(false); push('tasks', { filterTaskId: editingEvent.taskId }); }} className="flex items-center gap-2 p-3 bg-surface-neutral/30 rounded-xl border border-bd-subtle hover:border-accent-primary/50 transition-colors">
                  <CheckSquare size={16} className="text-tx-primary" />
                  <span className="text-[14px] font-medium text-tx-primary">Task</span>
                </button>
              )}

              <button onClick={() => { 
                setSheetOpen(false); 
                startTimerFor({ projectId: editingEvent.projectId, taskId: editingEvent.taskId, clientId: editingEvent.clientId, note: editingEvent.title });
                push('time-tracker');
              }} className="flex items-center gap-2 p-3 bg-accent-primary/10 rounded-xl border border-accent-primary/20 hover:border-accent-primary/50 transition-colors">
                <Clock size={16} className="text-accent-primary" />
                <span className="text-[14px] font-medium text-accent-primary">Start Timer</span>
              </button>

            </div>
          </div>
        )}

      </BottomSheet>

      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={() => {
          if (editingEvent) {
            deleteEvent(editingEvent.id);
            setSheetOpen(false);
            setDeleteConfirmOpen(false);
          }
        }}
        title="Delete Scheduled Item"
        body="Are you sure you want to delete this from your schedule? Associated tasks or projects will not be deleted."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
