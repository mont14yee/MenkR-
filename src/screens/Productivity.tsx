import React, { useState } from 'react';
import { Calendar, CheckSquare, FolderHeart, LayoutTemplate, Plus, Search, MoreVertical, Play, Clock } from 'lucide-react';
import { PushedScreenState, TaskItem, EventItem } from '../types';
import { Card, CardContent, CardHeader, CardTitle, IconButton, Button, Badge } from '../components/ui';
import { useTasks } from '../context/TasksContext';
import { useCalendar } from '../context/CalendarContext';
import { useTemplates } from '../context/TemplatesContext';
import { useLibrary } from '../context/LibraryContext';

export function Productivity({ onPush }: { onPush: (screen: PushedScreenState) => void }) {
  const { tasks, completeTask } = useTasks();
  const { events } = useCalendar();
  const { templates } = useTemplates();
  const { library } = useLibrary();

  const activeTasks = tasks.filter(t => t.status === 'active' || t.status === 'upcoming').slice(0, 3);
  const todayEvents = events.filter(e => e.date === new Date().toISOString().split('T')[0]).slice(0, 3);

  return (
    <div className="flex flex-col h-full bg-surface-neutral/10 overflow-y-auto no-scrollbar pb-28 md:pb-12">
      <header className="px-5 pt-12 pb-6 md:pt-16 md:px-8 bg-canvas border-b border-bd-subtle shrink-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[28px] font-bold tracking-tight text-tx-primary">Productivity</h1>
            <p className="text-[15px] text-tx-muted mt-1">Your central workspace for daily execution.</p>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <IconButton variant="secondary"><Search size={20} /></IconButton>
            <IconButton variant="secondary"><MoreVertical size={20} /></IconButton>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          <Button variant="primary" leftIcon={<Plus size={16} />} onClick={() => onPush('tasks')}>New Task</Button>
          <Button variant="secondary" leftIcon={<Calendar size={16} />} onClick={() => onPush('calendar')}>Schedule</Button>
          <Button variant="secondary" leftIcon={<LayoutTemplate size={16} />} onClick={() => onPush('templates')}>Use Template</Button>
          <Button variant="secondary" leftIcon={<FolderHeart size={16} />} onClick={() => onPush('library')}>Add to Library</Button>
        </div>
      </header>

      <div className="flex-1 p-5 md:p-8 space-y-6 md:space-y-8">
        
        {/* Core Modules Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ModuleCard title="Tasks" icon={<CheckSquare size={16} />} count={tasks.length} desc="What needs to be done" onClick={() => onPush('tasks')} />
          <ModuleCard title="Schedule" icon={<Calendar size={16} />} count={events.length} desc="When it happens" onClick={() => onPush('calendar')} />
          <ModuleCard title="Templates" icon={<LayoutTemplate size={16} />} count={templates.length} desc="How recurring work is organized" onClick={() => onPush('templates')} />
          <ModuleCard title="Library" icon={<FolderHeart size={16} />} count={library.length} desc="Where supporting assets live" onClick={() => onPush('library')} />
        </div>

        {/* Today's Focus */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tasks Focus */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-bd-subtle/50 mb-4">
              <CardTitle className="text-lg">Up Next: Tasks</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onPush('tasks')}>View All</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeTasks.length === 0 ? (
                <div className="text-center py-6 text-tx-muted text-sm">No active tasks.</div>
              ) : (
                activeTasks.map(task => (
                  <div key={task.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface-neutral/30 border border-bd-subtle">
                    <button 
                      onClick={() => completeTask(task.id)}
                      className="mt-0.5 shrink-0 w-5 h-5 rounded-md border border-tx-muted flex items-center justify-center text-canvas"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-tx-primary truncate">{task.title}</p>
                      {task.notes && <p className="text-sm text-tx-muted truncate mt-0.5">{task.notes}</p>}
                    </div>
                    <Badge variant="outline">{task.priority}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Schedule Focus */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-bd-subtle/50 mb-4">
              <CardTitle className="text-lg">Today's Schedule</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => onPush('calendar')}>View All</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {todayEvents.length === 0 ? (
                <div className="text-center py-6 text-tx-muted text-sm">No events scheduled for today.</div>
              ) : (
                todayEvents.map(event => (
                  <div key={event.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-neutral/30 border border-bd-subtle">
                    <div className="w-12 text-center shrink-0">
                      <p className="text-sm font-semibold text-tx-primary">{event.startTime || 'All'}</p>
                    </div>
                    <div className="flex-1 min-w-0 border-l border-bd-subtle pl-3">
                      <p className="font-medium text-tx-primary truncate">{event.title}</p>
                      {event.location && <p className="text-xs text-tx-muted truncate mt-0.5">{event.location}</p>}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>


        {/* Additional Tools */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-tx-primary mb-4">More Tools</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="hover:border-accent-primary/50 transition-colors cursor-pointer" onClick={() => onPush('time-tracker')}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-full bg-surface-neutral flex items-center justify-center text-tx-primary">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-tx-primary">Time Tracker</h3>
                  <p className="text-sm text-tx-muted">Track billable hours</p>
                </div>
              </CardContent>
            </Card>
            <Card className="hover:border-accent-primary/50 transition-colors cursor-pointer" onClick={() => onPush('finance')}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-full bg-surface-neutral flex items-center justify-center text-tx-primary">
                  <span className="font-bold">$</span>
                </div>
                <div>
                  <h3 className="font-semibold text-tx-primary">Finance</h3>
                  <p className="text-sm text-tx-muted">Revenue & invoices</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModuleCard({ title, icon, count, desc, onClick }: { title: string, icon: React.ReactNode, count: number, desc: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-start p-4 md:p-5 rounded-[20px] bg-canvas border border-bd-subtle hover:border-accent-primary/50 hover:shadow-sm active:bg-surface-neutral transition-all text-left"
    >
      <div className="flex w-full items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-full bg-surface-neutral flex items-center justify-center text-tx-primary">
          {icon}
        </div>
        <span className="text-lg font-light text-tx-muted">{count}</span>
      </div>
      <h3 className="font-semibold text-tx-primary text-base md:text-lg leading-tight">{title}</h3>
      <p className="text-xs md:text-sm text-tx-muted mt-1 leading-snug line-clamp-2">{desc}</p>
    </button>
  );
}
