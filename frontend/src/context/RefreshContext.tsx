import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

interface RefreshContextType {
  refreshKey: number;
  triggerRefresh: () => void;
  isRefreshing: boolean;
  setIsRefreshing: (value: boolean) => void;
}

const RefreshContext = createContext<RefreshContextType | undefined>(undefined);

export const RefreshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    setRefreshKey(prev => prev + 1);
    setIsRefreshing(true);

    refreshTimerRef.current = setTimeout(() => {
      setIsRefreshing(false);
    }, 2000);
  }, []);

  return (
    <RefreshContext.Provider value={{ refreshKey, triggerRefresh, isRefreshing, setIsRefreshing }}>
      {children}
    </RefreshContext.Provider>
  );
};

export const useRefresh = () => {
  const context = useContext(RefreshContext);
  if (!context) {
    throw new Error('useRefresh must be used within a RefreshProvider');
  }
  return context;
};
