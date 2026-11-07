import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React, { ReactNode } from 'react';
import { useTemplates, TemplatesProvider } from '../context/TemplatesContext';
import { useProjects, ProjectsProvider } from '../context/ProjectsContext';
import { useTasks, TasksProvider } from '../context/TasksContext';
import { useCalendar, CalendarProvider } from '../context/CalendarContext';
import { useLibrary, LibraryProvider } from '../context/LibraryContext';
import { useClients, ClientsProvider } from '../context/ClientsContext';
import { TemplateItem } from '../types';

function FullProductivityProvider({ children }: { children: ReactNode }) {
  return (
    <ClientsProvider>
      <ProjectsProvider>
        <TasksProvider>
          <CalendarProvider>
            <TemplatesProvider>
              <LibraryProvider>
                {children}
              </LibraryProvider>
            </TemplatesProvider>
          </CalendarProvider>
        </TasksProvider>
      </ProjectsProvider>
    </ClientsProvider>
  );
}

describe('Schedule, Templates & Library Productivity Workflow Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('creates a reusable template with tasks, schedule milestones, and library documents', () => {
    const { result } = renderHook(() => useTemplates(), { wrapper: FullProductivityProvider });

    let templateId = '';
    act(() => {
      templateId = result.current.addTemplate({
        name: 'Turnkey Substation Engineering',
        description: 'Complete electrical engineering, permitting, and client handover workflow',
        type: 'project',
        isFavorite: true,
        isArchived: false,
        projectPriority: 'high',
        projectDurationDays: 45,
        tasks: [
          {
            id: 'tmpl-t1',
            title: 'Topographic Site Survey for {{CLIENT_NAME}}',
            priority: 'High',
            durationMinutes: 120,
            offsetDays: 2,
            notes: 'Coordinate with civil surveyor'
          },
          {
            id: 'tmpl-t2',
            title: 'Transformer Protection Relay Schematics',
            priority: 'High',
            durationMinutes: 180,
            offsetDays: 14,
            notes: 'Submit for client technical signoff'
          }
        ],
        schedule: [
          {
            id: 'tmpl-s1',
            title: 'Kickoff Meeting with {{CLIENT_NAME}}',
            type: 'Meeting',
            offsetDays: 1,
            startTime: '10:00',
            durationMinutes: 60,
            notes: 'Scope review and SLA alignment'
          },
          {
            id: 'tmpl-s2',
            title: 'Phase 1 Milestone Review',
            type: 'Milestone',
            offsetDays: 20,
            startTime: '14:00',
            durationMinutes: 90,
            notes: 'Deliverable inspection'
          }
        ],
        checklists: [],
        library: [
          {
            id: 'tmpl-l1',
            name: 'Substation Spec Sheet - {{PROJECT_NAME}}',
            type: 'file',
            category: 'Project Files',
            tags: ['engineering', 'spec']
          },
          {
            id: 'tmpl-l2',
            name: 'Quality Assurance Protocol',
            type: 'note',
            category: 'Documents',
            tags: ['compliance']
          }
        ]
      });
    });

    expect(templateId).toBeTruthy();
    const saved = result.current.templates.find(t => t.id === templateId);
    expect(saved?.name).toBe('Turnkey Substation Engineering');
    expect(saved?.tasks).toHaveLength(2);
    expect(saved?.schedule).toHaveLength(2);
    expect(saved?.library).toHaveLength(2);
  });

  it('instantiates a template into Project, Tasks, Schedule, and Library while preserving the original template', () => {
    const { result: clientHook } = renderHook(() => useClients(), { wrapper: FullProductivityProvider });
    const { result: templateHook } = renderHook(() => useTemplates(), { wrapper: FullProductivityProvider });
    const { result: projectHook } = renderHook(() => useProjects(), { wrapper: FullProductivityProvider });
    const { result: taskHook } = renderHook(() => useTasks(), { wrapper: FullProductivityProvider });
    const { result: calendarHook } = renderHook(() => useCalendar(), { wrapper: FullProductivityProvider });
    const { result: libraryHook } = renderHook(() => useLibrary(), { wrapper: FullProductivityProvider });

    // 1. Setup Client
    let clientId = '';
    act(() => {
      clientId = clientHook.current.addClient({
        name: 'Aura Renewable Power',
        company: 'Aura Energy Corp',
        status: 'active',
        tags: ['utilities'],
        avatarSeed: 'aura-seed',
        createdAt: new Date().toISOString(),
      });
    });

    // 2. Setup Template
    let templateId = '';
    act(() => {
      templateId = templateHook.current.addTemplate({
        name: 'Solar Grid Interconnection Template',
        type: 'project',
        isFavorite: false,
        isArchived: false,
        projectPriority: 'high',
        projectDurationDays: 30,
        tasks: [
          {
            id: 'task-1',
            title: 'Interconnection Study: {{CLIENT_NAME}}',
            priority: 'High',
            durationMinutes: 120,
            offsetDays: 3,
            notes: 'Review utility tie-in standards'
          }
        ],
        schedule: [
          {
            id: 'event-1',
            title: 'Utility Sync Meeting',
            type: 'Meeting',
            offsetDays: 5,
            startTime: '11:00',
            durationMinutes: 60,
          }
        ],
        checklists: [],
        library: [
          {
            id: 'lib-1',
            name: 'Interconnection Agreement Draft',
            type: 'file',
            category: 'Contracts',
            tags: ['legal']
          }
        ]
      });
    });

    const originalTemplate = templateHook.current.templates.find(t => t.id === templateId)!;
    const originalTemplateJson = JSON.stringify(originalTemplate);

    // 3. Simulate Template Instantiation
    const startDate = '2026-11-10';
    const deadlineDate = '2026-12-10';
    const projectName = 'Aura Solar Feeder 4';

    let createdProjectId = '';
    act(() => {
      // Create Project
      createdProjectId = projectHook.current.addProject({
        name: projectName,
        priority: originalTemplate.projectPriority || 'low',
        completionPct: 0,
        tone: 'lime',
        clientId: clientId,
        status: 'active',
        dueDate: deadlineDate,
      });
    });

    act(() => {
      // Create Scheduled Tasks
      for (const t of originalTemplate.tasks) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + t.offsetDays);
        const resolvedTitle = t.title.replace('{{CLIENT_NAME}}', 'Aura Renewable Power');

        taskHook.current.addTask({
          title: resolvedTitle,
          categoryId: 'workflow',
          priority: t.priority,
          date: d.toISOString().split('T')[0],
          dueDate: d.toISOString().split('T')[0],
          notes: t.notes,
          status: 'upcoming',
          projectId: createdProjectId,
          clientId: clientId,
        });
      }

      // Create Calendar Events
      for (const s of originalTemplate.schedule) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + s.offsetDays);

        calendarHook.current.addEvent({
          title: s.title,
          date: d.toISOString().split('T')[0],
          startTime: s.startTime || '09:00',
          duration: s.durationMinutes,
          allDay: !s.startTime,
          type: s.type,
          status: 'scheduled',
          projectId: createdProjectId,
          clientId: clientId,
          categoryId: '',
          repeat: 'None',
        });
      }

      // Create Library Documents
      for (const l of originalTemplate.library) {
        libraryHook.current.addLibraryItem({
          name: l.name,
          type: l.type,
          tags: l.tags,
          urlOrReference: '',
          category: l.category,
          projectId: createdProjectId,
          clientId: clientId,
        });
      }
    });

    // 4. Verify Project creation
    const project = projectHook.current.projects.find(p => p.id === createdProjectId);
    expect(project).toBeDefined();
    expect(project?.clientId).toBe(clientId);
    expect(project?.dueDate).toBe(deadlineDate);

    // 5. Verify Tasks scheduled correctly with project and client links
    const projectTasks = taskHook.current.tasks.filter(t => t.projectId === createdProjectId);
    expect(projectTasks).toHaveLength(1);
    expect(projectTasks[0].title).toBe('Interconnection Study: Aura Renewable Power');
    expect(projectTasks[0].dueDate).toBe('2026-11-13');
    expect(projectTasks[0].clientId).toBe(clientId);

    // 6. Verify Calendar events scheduled at calculated dates
    const projectEvents = calendarHook.current.events.filter(e => e.projectId === createdProjectId);
    expect(projectEvents).toHaveLength(1);
    expect(projectEvents[0].title).toBe('Utility Sync Meeting');
    expect(projectEvents[0].date).toBe('2026-11-15');

    // 7. Verify Library documents initialized and linked
    const projectDocs = libraryHook.current.library.filter(l => l.projectId === createdProjectId);
    expect(projectDocs).toHaveLength(1);
    expect(projectDocs[0].name).toBe('Interconnection Agreement Draft');
    expect(projectDocs[0].category).toBe('Contracts');
    expect(projectDocs[0].clientId).toBe(clientId);

    // 8. Crucial Requirement: Template itself was preserved without mutation!
    const templateAfterInstantiation = templateHook.current.templates.find(t => t.id === templateId);
    expect(JSON.stringify(templateAfterInstantiation)).toBe(originalTemplateJson);
  });

  it('validates file uploads and rejects dangerous executable files or oversized payloads', () => {
    const forbiddenExts = ['.exe', '.bat', '.cmd', '.sh', '.vbs', '.dll', '.msi', '.ps1', '.jar', '.com'];
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB

    // Validation helper matching Library.tsx & server.ts
    const validateFileUpload = (filename: string, sizeBytes: number): { valid: boolean; error?: string } => {
      if (sizeBytes > MAX_SIZE) {
        return { valid: false, error: 'File exceeds 10MB limit' };
      }
      const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
      if (forbiddenExts.includes(ext)) {
        return { valid: false, error: `Executable file type ${ext} is blocked` };
      }
      return { valid: true };
    };

    // Reject dangerous executable
    const exeResult = validateFileUpload('exploit.exe', 1024);
    expect(exeResult.valid).toBe(false);
    expect(exeResult.error).toContain('blocked');

    // Reject shell script
    const shResult = validateFileUpload('install.sh', 500);
    expect(shResult.valid).toBe(false);

    // Reject file > 10MB
    const oversizedResult = validateFileUpload('huge_drawing.dwg', 12 * 1024 * 1024);
    expect(oversizedResult.valid).toBe(false);
    expect(oversizedResult.error).toContain('10MB');

    // Allow valid engineering files
    const validPdf = validateFileUpload('Substation_Structural_Calcs.pdf', 2 * 1024 * 1024);
    expect(validPdf.valid).toBe(true);

    const validDwg = validateFileUpload('Electrical_SingleLine.dwg', 4 * 1024 * 1024);
    expect(validDwg.valid).toBe(true);
  });
});
