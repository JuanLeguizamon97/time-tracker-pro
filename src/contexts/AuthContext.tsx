import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { Employee, AppRole } from '@/types';
import { api } from '@/lib/api';

interface AuthContextType {
  employee: Employee | null;
  role: AppRole;
  isLoading: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [role, setRole] = useState<AppRole>('employee');
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    const raw = localStorage.getItem('mock_user');
    if (!raw) {
      setEmployee(null);
      setIsLoading(false);
      return;
    }
    try {
      const emp = await api.get<Employee>('/employees/me');
      setEmployee(emp);
      const roles = await api.get<{ id: string; user_id: string; role: AppRole }[]>('/user-roles');
      const found = roles.find(r => r.user_id === emp.id);
      setRole(found?.role ?? 'employee');
    } catch {
      setEmployee(null);
      setRole('employee');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const signOut = async () => {
    localStorage.removeItem('mock_user');
    setEmployee(null);
    setRole('employee');
    window.location.href = '/auth';
  };

  const value: AuthContextType = {
    employee,
    role,
    isLoading,
    isAdmin: role === 'admin',
    isAuthenticated: !!employee,
    signIn: async () => { window.location.href = '/auth'; },
    signOut,
    refreshProfile: loadProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
