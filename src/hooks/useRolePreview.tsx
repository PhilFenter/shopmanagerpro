import { createContext, useContext, useState, ReactNode } from 'react';

interface RolePreviewContextType {
  isPreviewingAsTeam: boolean;
  togglePreview: () => void;
  setPreviewingAsTeam: (value: boolean) => void;
}

const RolePreviewContext = createContext<RolePreviewContextType | undefined>(undefined);

export function RolePreviewProvider({ children }: { children: ReactNode }) {
  const [isPreviewingAsTeam, setIsPreviewingAsTeam] = useState(false);

  const togglePreview = () => setIsPreviewingAsTeam(prev => !prev);
  const setPreviewingAsTeam = (value: boolean) => setIsPreviewingAsTeam(value);

  return (
    <RolePreviewContext.Provider value={{ isPreviewingAsTeam, togglePreview, setPreviewingAsTeam }}>
      {children}
    </RolePreviewContext.Provider>
  );
}

export function useRolePreview() {
  const context = useContext(RolePreviewContext);
  if (context === undefined) {
    throw new Error('useRolePreview must be used within a RolePreviewProvider');
  }
  return context;
}
