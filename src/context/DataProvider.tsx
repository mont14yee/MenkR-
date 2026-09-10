import React, { ReactNode } from 'react';
import { TasksProvider } from './TasksContext';
import { ProjectsProvider } from './ProjectsContext';
import { RevenueProvider } from './RevenueContext';
import { CalendarProvider } from './CalendarContext';
import { TimeTrackerProvider } from './TimeTrackerContext';
import { NavigationProvider } from './NavigationContext';
import { ClientsProvider } from './ClientsContext';
import { MessagesProvider } from './MessagesContext';
import { ProfileProvider } from './ProfileContext';
import { TemplatesProvider } from './TemplatesContext';
import { LibraryProvider } from './LibraryContext';

export function DataProvider({ children }: { children: ReactNode }) {
  return (
    <NavigationProvider>
      <ClientsProvider>
        <MessagesProvider>
          <ProfileProvider>
            <TemplatesProvider>
              <LibraryProvider>
                <TasksProvider>
                  <ProjectsProvider>
                    <RevenueProvider>
                      <CalendarProvider>
                        <TimeTrackerProvider>
                          {children}
                        </TimeTrackerProvider>
                      </CalendarProvider>
                    </RevenueProvider>
                  </ProjectsProvider>
                </TasksProvider>
              </LibraryProvider>
            </TemplatesProvider>
          </ProfileProvider>
        </MessagesProvider>
      </ClientsProvider>
    </NavigationProvider>
  );
}
