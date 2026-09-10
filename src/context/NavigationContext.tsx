import React, { createContext, useContext, useState, ReactNode } from 'react';
import { TabState, PushedScreenState } from '../types';

interface NavigationOptions {
  [key: string]: any;
}

interface NavigationContextValue {
  activeTab: TabState;
  pushedScreen: PushedScreenState;
  navigationOptions: NavigationOptions | null;
  push: (screen: PushedScreenState, options?: NavigationOptions) => void;
  dismiss: () => void;
  goToTab: (tab: TabState, options?: NavigationOptions) => void;
  goToClient: (clientId: string) => void;
}

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<TabState>('dashboard');
  const [pushedScreen, setPushedScreen] = useState<PushedScreenState>('none');
  const [navigationOptions, setNavigationOptions] = useState<NavigationOptions | null>(null);

  const push = (screen: PushedScreenState, options?: NavigationOptions) => {
    setPushedScreen(screen);
    if (options) {
      setNavigationOptions(options);
    }
  };

  const dismiss = () => {
    setPushedScreen('none');
    setNavigationOptions(null);
  };

  const goToTab = (tab: TabState, options?: NavigationOptions) => {
    setActiveTab(tab);
    if (options) {
      setNavigationOptions(options);
    }
  };

  const goToClient = (clientId: string) => {
    dismiss();
    goToTab('clients', { clientId });
  };

  return (
    <NavigationContext.Provider value={{ activeTab, pushedScreen, navigationOptions, push, dismiss, goToTab, goToClient }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
