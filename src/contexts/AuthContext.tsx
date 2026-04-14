import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { useMsal, useAccount } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { loginRequest } from '@/config/msalConfig';
import { Employee, AppRole } from '@/types';
import { api } from '@/lib/api';

const AUTH_MODE = import.meta.env.VITE_AUTH_MODE ?? 'azure';

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

  // MSAL hooks — always called (MsalProvider always wraps the app in main.tsx)
  const { instance, accounts, inProgress } = useMsal();
  const account = useAccount(accounts[0] ?? null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
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
    if (AUTH_MODE === 'mock') {
      // Mock mode: check for localStorage session
      const raw = localStorage.getItem('mock_user');
      if (!raw) {
        setEmployee(null);
        setIsLoading(false);
        return;
      }
      loadProfile();
      return;
    }

    // Azure mode: wait until MSAL finishes any in-progress interaction
    // (e.g., handling the redirect response after Microsoft login)
    if (inProgress !== InteractionStatus.None) return;

    if (!account) {
      setEmployee(null);
      setIsLoading(false);
      return;
    }

    loadProfile();
    // account.homeAccountId is the stable identifier — re-run only when the
    // signed-in account changes (login / logout).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.homeAccountId, inProgress]);

  const signIn = async () => {
    if (AUTH_MODE === 'mock') {
      window.location.href = '/auth';
      return;
    }
    await instance.loginRedirect(loginRequest);
  };

  const signOut = async () => {
    if (AUTH_MODE === 'mock') {
      localStorage.removeItem('mock_user');
      setEmployee(null);
      setRole('employee');
      window.location.href = '/auth';
      return;
    }
    setEmployee(null);
    await instance.logoutRedirect({ postLogoutRedirectUri: '/auth' });
  };

  return (
    <AuthContext.Provider value={{
      employee,
      role,
      isLoading,
      isAdmin: role === 'admin',
      isAuthenticated: !!employee,
      signIn,
      signOut,
      refreshProfile: loadProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
