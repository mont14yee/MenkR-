import React, { Suspense } from 'react';
import { Navigation } from './components/Navigation';
import { Sidebar } from './components/Sidebar';
import { PreferencesProvider } from './context/PreferencesContext';
import { ToastProvider } from './context/ToastContext';
import { DataProvider } from './context/DataProvider';
import { useNavigation } from './context/NavigationContext';
import { Dashboard } from './screens/Dashboard';
import { Projects } from './screens/Projects';
import { Productivity } from './screens/Productivity';
import { Clients } from './screens/Clients';
import { Tasks } from './screens/Tasks';
import { Calendar } from './screens/Calendar';
import { Finance } from './screens/Finance';
import { TimeTracker } from './screens/TimeTracker';
import { Settings } from './screens/Settings';
import { Templates } from './screens/Templates';
import { Library } from './screens/Library';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Onboarding } from './components/Onboarding';
import { CommandPaletteProvider } from './context/CommandPaletteContext';
import { CommandPalette } from './components/CommandPalette';
import { Loader2 } from 'lucide-react';

function KeepAliveTab({ active, children }: { active: boolean, children: React.ReactNode }) {
  const [hasBeenActive, setHasBeenActive] = React.useState(active);
  if (active && !hasBeenActive) setHasBeenActive(true);
  
  if (!hasBeenActive) return null;
  return <div className={active ? 'block h-full overflow-y-auto' : 'hidden'}>{children}</div>;
}

function MainApp() {
  const { activeTab, pushedScreen, push, dismiss, goToTab, navigationOptions } = useNavigation();

  return (
    <div className="flex w-full h-[100dvh] bg-canvas overflow-hidden">
      <Onboarding />
      
      {/* Desktop Sidebar (hidden on mobile) */}
      <Sidebar 
        activeTab={activeTab} 
        pushedScreen={pushedScreen}
        onChangeTab={goToTab} 
        onPushScreen={push}
        onDismissScreen={dismiss}
      />

      {/* Main Content Area */}
      <main className="flex-1 relative h-full flex flex-col min-w-0">
        
        {/* Active Tabs (only show if no screen is pushed, OR if on desktop where we might want split views later. 
            For now, follow mobile paradigm but responsive) */}
        <div className={`w-full h-full relative z-0 ${pushedScreen === 'none' ? 'block' : 'hidden md:hidden'}`}>
          <KeepAliveTab active={activeTab === 'dashboard'}><Dashboard onPush={push} /></KeepAliveTab>
          <KeepAliveTab active={activeTab === 'projects'}><Projects /></KeepAliveTab>
          <KeepAliveTab active={activeTab === 'productivity' || activeTab === 'tools'}><Productivity onPush={push} /></KeepAliveTab>
          <KeepAliveTab active={activeTab === 'clients'}><Clients initialClientId={navigationOptions?.clientId} initialOpenCreate={navigationOptions?.openCreate} /></KeepAliveTab>
        </div>

        {/* Pushed Screens */}
        <div className={`absolute inset-0 z-50 bg-canvas md:relative md:z-0 md:h-full ${pushedScreen !== 'none' ? 'block' : 'hidden'}`}>
          {pushedScreen === 'tasks' && <Tasks onDismiss={dismiss} />}
          {pushedScreen === 'calendar' && <Calendar onDismiss={dismiss} />}
          {pushedScreen === 'finance' && <Finance onDismiss={dismiss} />}
          {pushedScreen === 'time-tracker' && <TimeTracker onDismiss={dismiss} />}
          {pushedScreen === 'settings' && <Settings onDismiss={dismiss} />}
          {pushedScreen === 'templates' && <Templates onDismiss={dismiss} />}
          {pushedScreen === 'library' && <Library onDismiss={dismiss} />}
        </div>
      </main>

      {/* Mobile Bottom Navigation (hidden on desktop) */}
      <Navigation activeTab={activeTab} onChange={(tab) => goToTab(tab)} />
      <CommandPalette />
    </div>
  );
}

export default function App() {
  return (
    <PreferencesProvider>
      <CommandPaletteProvider>
        <DataProvider>
          <ToastProvider>
            <ErrorBoundary>
              <MainApp />
            </ErrorBoundary>
          </ToastProvider>
        </DataProvider>
      </CommandPaletteProvider>
    </PreferencesProvider>
  );
}


