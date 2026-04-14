import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { loginRequest } from '@/config/msalConfig';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { Employee } from '@/types';

const AUTH_MODE = import.meta.env.VITE_AUTH_MODE ?? 'azure';
const MOCK_PASSWORD = 'Impact2026';

// Microsoft four-color logo (inline SVG — no external requests)
function MicrosoftLogo({ size = 20 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 21 21">
      <rect x="1"  y="1"  width="9" height="9" fill="#f25022" />
      <rect x="11" y="1"  width="9" height="9" fill="#7fba00" />
      <rect x="1"  y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

// ── Azure mode login page ──────────────────────────────────────────────────────
function AzureLoginPage() {
  const { instance, inProgress } = useMsal();
  const isAzureAuthenticated = useIsAuthenticated();
  const { isAuthenticated, isLoading: profileLoading } = useAuth();

  // Show spinner while:
  //   - MSAL is handling the redirect response (auth code in URL)
  //   - MSAL has an account but the employee profile hasn't loaded yet
  const handlingRedirect = inProgress === InteractionStatus.HandleRedirect;
  const waitingForProfile = isAzureAuthenticated && profileLoading;

  if (handlingRedirect || waitingForProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-md">
              <Clock className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Horas+</CardTitle>
          <CardDescription className="text-sm">
            Impact Point Hours Tracker
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5 pt-4 pb-8">
          <p className="text-center text-sm text-muted-foreground leading-relaxed">
            Sign in with your <span className="font-medium text-foreground">Impact Point</span> Microsoft account to continue.
          </p>

          <Button
            variant="outline"
            className="w-full h-11 gap-3 text-sm font-medium border-2 hover:bg-accent"
            onClick={() => instance.loginRedirect(loginRequest)}
            disabled={inProgress !== InteractionStatus.None}
          >
            {inProgress !== InteractionStatus.None
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <MicrosoftLogo />
            }
            Sign in with Microsoft
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Only <span className="font-medium">@impactpoint.us</span> organization accounts are allowed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Mock mode login page (local dev only) ─────────────────────────────────────
function MockLoginPage() {
  const { isAuthenticated, isLoading, refreshProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== MOCK_PASSWORD) {
      toast.error('Incorrect password.');
      return;
    }
    setSubmitting(true);
    try {
      localStorage.setItem('mock_user', JSON.stringify({ email: email.trim().toLowerCase(), name: '' }));
      const emp = await api.get<Employee>('/employees/me');
      localStorage.setItem('mock_user', JSON.stringify({ email: emp.email, name: emp.name }));
      await refreshProfile();
    } catch {
      localStorage.removeItem('mock_user');
      toast.error('No account found with that email. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Clock className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Horas+ <span className="text-sm font-normal text-muted-foreground">(dev)</span></CardTitle>
          <CardDescription>Mock mode — enter your employee email</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@impactpoint.us"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Entry point ────────────────────────────────────────────────────────────────
export default function Auth() {
  return AUTH_MODE === 'mock' ? <MockLoginPage /> : <AzureLoginPage />;
}
