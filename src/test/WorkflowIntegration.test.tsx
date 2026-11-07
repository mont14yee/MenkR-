import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClients, ClientsProvider } from '../context/ClientsContext';
import { useProjects, ProjectsProvider } from '../context/ProjectsContext';
import { useTasks, TasksProvider } from '../context/TasksContext';
import { checkClientDependencies, checkProjectDependencies } from '../services/activityService';
import React, { ReactNode } from 'react';

// Wrapper with all workflow providers
function WorkflowProvider({ children }: { children: ReactNode }) {
  return (
    <ClientsProvider>
      <ProjectsProvider>
        <TasksProvider>
          {children}
        </TasksProvider>
      </ProjectsProvider>
    </ClientsProvider>
  );
}

describe('Client -> Project -> Task Workflow Integration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('links projects to clients and maintains relational integrity', () => {
    const { result: clientHook } = renderHook(() => useClients(), { wrapper: WorkflowProvider });
    const { result: projectHook } = renderHook(() => useProjects(), { wrapper: WorkflowProvider });

    let clientId = '';
    act(() => {
      clientId = clientHook.current.addClient({
        name: 'Apex Horizon Corp',
        company: 'Apex Horizon',
        email: 'david@apexhorizon.com',
        phone: '+1 555-0199',
        status: 'active',
        tags: ['enterprise', 'construction'],
        avatarSeed: 'apex-1',
        createdAt: new Date().toISOString(),
      });
    });

    expect(clientId).toBeTruthy();
    expect(clientHook.current.clients.find(c => c.id === clientId)?.name).toBe('Apex Horizon Corp');

    let projectId = '';
    act(() => {
      projectId = projectHook.current.addProject({
        name: 'Headquarters Tower Phase 2',
        priority: 'high',
        completionPct: 0,
        tone: 'lime',
        status: 'active',
        clientId: clientId,
        dueDate: '2026-12-15',
        budget: 1200000,
        assignedMemberIds: ['usr-1', 'usr-2'],
      });
    });

    expect(projectId).toBeTruthy();
    const createdProject = projectHook.current.projects.find(p => p.id === projectId);
    expect(createdProject?.clientId).toBe(clientId);
    expect(createdProject?.budget).toBe(1200000);
    expect(createdProject?.assignedMemberIds).toContain('usr-1');

    // Filter projects by client
    const clientProjects = projectHook.current.projects.filter(p => p.clientId === clientId);
    expect(clientProjects).toHaveLength(1);
    expect(clientProjects[0].name).toBe('Headquarters Tower Phase 2');
  });

  it('assigns tasks to projects & clients and automatically calculates project completion percentage', () => {
    const { result: clientHook } = renderHook(() => useClients(), { wrapper: WorkflowProvider });
    const { result: projectHook } = renderHook(() => useProjects(), { wrapper: WorkflowProvider });
    const { result: taskHook } = renderHook(() => useTasks(), { wrapper: WorkflowProvider });

    let clientId = '';
    let projectId = '';

    act(() => {
      clientId = clientHook.current.addClient({
        name: 'Nordic Infrastructure',
        company: 'Nordic Infra AB',
        status: 'active',
        tags: ['energy'],
        avatarSeed: 'nordic-1',
        createdAt: new Date().toISOString(),
      });
    });

    act(() => {
      projectId = projectHook.current.addProject({
        name: 'Substation Alpha Design',
        priority: 'high',
        completionPct: 0,
        tone: 'olive',
        status: 'active',
        clientId: clientId,
      });
    });

    let taskId1 = '';
    let taskId2 = '';

    act(() => {
      taskId1 = taskHook.current.addTask({
        title: 'Geotechnical Soil Assessment',
        categoryId: 'engineering',
        projectId: projectId,
        clientId: clientId,
        assigneeId: 'usr-3',
        assigneeName: 'Marcus Brody',
        dueDate: '2026-11-10',
        priority: 'High',
        status: 'active',
      });

      taskId2 = taskHook.current.addTask({
        title: 'Single-Line Circuit Schematics',
        categoryId: 'design',
        projectId: projectId,
        clientId: clientId,
        assigneeId: 'usr-2',
        assigneeName: 'Sarah Chen',
        dueDate: '2026-11-20',
        priority: 'Medium',
        status: 'active',
      });
    });

    // Check relationship links
    const projectTasks = taskHook.current.tasks.filter(t => t.projectId === projectId);
    expect(projectTasks).toHaveLength(2);
    expect(projectTasks[0].clientId).toBe(clientId);
    expect(projectTasks[0].assigneeName).toBe('Marcus Brody');

    // Complete task 1 -> 50% project completion
    act(() => {
      taskHook.current.completeTask(taskId1);
    });

    act(() => {
      const updatedTasks = taskHook.current.tasks.filter(t => t.projectId === projectId);
      const completed = updatedTasks.filter(t => t.status === 'done').length;
      const newPct = Math.round((completed / updatedTasks.length) * 100);
      projectHook.current.updateProject(projectId, { completionPct: newPct });
    });

    expect(projectHook.current.projects.find(p => p.id === projectId)?.completionPct).toBe(50);

    // Complete task 2 -> 100% project completion
    act(() => {
      taskHook.current.completeTask(taskId2);
    });

    act(() => {
      const updatedTasks = taskHook.current.tasks.filter(t => t.projectId === projectId);
      const completed = updatedTasks.filter(t => t.status === 'done').length;
      const newPct = Math.round((completed / updatedTasks.length) * 100);
      projectHook.current.updateProject(projectId, { completionPct: newPct });
    });

    expect(projectHook.current.projects.find(p => p.id === projectId)?.completionPct).toBe(100);

    // Reopen task 1 -> drops to 50%
    act(() => {
      taskHook.current.completeTask(taskId1); // toggles back to active
    });

    act(() => {
      const updatedTasks = taskHook.current.tasks.filter(t => t.projectId === projectId);
      const completed = updatedTasks.filter(t => t.status === 'done').length;
      const newPct = Math.round((completed / updatedTasks.length) * 100);
      projectHook.current.updateProject(projectId, { completionPct: newPct });
    });

    expect(projectHook.current.projects.find(p => p.id === projectId)?.completionPct).toBe(50);
  });

  it('supports safe archiving without losing historical linkage or records', () => {
    const { result: clientHook } = renderHook(() => useClients(), { wrapper: WorkflowProvider });
    const { result: projectHook } = renderHook(() => useProjects(), { wrapper: WorkflowProvider });
    const { result: taskHook } = renderHook(() => useTasks(), { wrapper: WorkflowProvider });

    let clientId = '';
    let projectId = '';
    let taskId = '';

    act(() => {
      clientId = clientHook.current.addClient({
        name: 'Legacy Dynamics',
        status: 'active',
        tags: ['legacy'],
        avatarSeed: 'legacy-1',
        createdAt: new Date().toISOString(),
      });
      projectId = projectHook.current.addProject({
        name: 'Legacy Overhaul',
        priority: 'low',
        tone: 'neutral',
        completionPct: 100,
        status: 'active',
        clientId: clientId,
      });
      taskId = taskHook.current.addTask({
        title: 'Final Handover Documentation',
        categoryId: 'admin',
        priority: 'Low',
        projectId: projectId,
        clientId: clientId,
        status: 'done',
      });
    });

    // Archive project safely
    act(() => {
      projectHook.current.updateProject(projectId, { isArchived: true, status: 'completed' });
    });

    const project = projectHook.current.projects.find(p => p.id === projectId);
    expect(project?.isArchived).toBe(true);
    expect(project?.status).toBe('completed');

    // Archive client safely
    act(() => {
      clientHook.current.updateClient(clientId, { isArchived: true, status: 'past' });
    });

    const client = clientHook.current.clients.find(c => c.id === clientId);
    expect(client?.isArchived).toBe(true);

    // All links and tasks remain intact
    const task = taskHook.current.tasks.find(t => t.id === taskId);
    expect(task?.projectId).toBe(projectId);
    expect(task?.clientId).toBe(clientId);
  });

  it('checks client and project dependencies before deletion', async () => {
    // Mock server response for client and project dependencies check
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/dependencies/clients/client-123')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            hasDependencies: true,
            projectsCount: 2,
            tasksCount: 5,
            projects: [
              { id: 'p1', name: 'Project 1', status: 'active' },
              { id: 'p2', name: 'Project 2', status: 'completed' },
            ]
          }),
        });
      }
      if (url.includes('/api/dependencies/projects/proj-456')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            hasDependencies: true,
            tasksCount: 4,
            openTasksCount: 2,
            timeEntriesCount: 8,
          }),
        });
      }
      return Promise.reject(new Error(`Unknown url: ${url}`));
    });

    const clientDeps = await checkClientDependencies('fake-token', 'org-1', 'client-123');
    expect(clientDeps).not.toBeNull();
    expect(clientDeps!.hasDependencies).toBe(true);
    expect(clientDeps!.projectsCount).toBe(2);
    expect(clientDeps!.tasksCount).toBe(5);

    const projDeps = await checkProjectDependencies('fake-token', 'org-1', 'proj-456');
    expect(projDeps).not.toBeNull();
    expect(projDeps!.hasDependencies).toBe(true);
    expect(projDeps!.openTasksCount).toBe(2);
    expect(projDeps!.timeEntriesCount).toBe(8);
  });
});
