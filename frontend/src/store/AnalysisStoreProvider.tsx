'use client';

import { createContext, useContext, type ReactNode } from 'react';
import {
  useDashboardStore,
  type AnalysisStore,
  type DashboardState,
} from '@/store/useDashboardStore';

const AnalysisStoreContext = createContext<AnalysisStore>(useDashboardStore);

export function AnalysisStoreProvider({
  store,
  children,
}: {
  store: AnalysisStore;
  children: ReactNode;
}) {
  return (
    <AnalysisStoreContext.Provider value={store}>
      {children}
    </AnalysisStoreContext.Provider>
  );
}

export function useAnalysisStore<T>(selector: (s: DashboardState) => T): T {
  return useContext(AnalysisStoreContext)(selector);
}
