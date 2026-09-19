import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';

import { LogoMark } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Controls';
import { api, errorMessage } from '@/lib/api';
import { tzOffset } from '@/lib/dates';
import { useMe } from '@/lib/queries';

export function useStartDemo() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const start = async () => {
    setLoading(true);
    try {
      const user = await api.post('/auth/demo', { tzOffset: tzOffset() });
      qc.clear();
      qc.setQueryData(['me'], user);
      navigate('/app/today');
    } catch (e) {
      alert(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  return { start, loading };
}

export function AuthPage({ mode }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const demo = useStartDemo();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isSignup = mode === 'signup';

  // Already signed in with a real account → straight to the app.
  if (me && !me.isDemo) return <Navigate to="/app/today" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (me?.isDemo) await api.post('/auth/logout'); // leave the demo first
      const user = await api.post(
        isSignup ? '/auth/signup' : '/auth/login',
        isSignup ? { name, email, password } : { email, password },
      );
      qc.clear();
      qc.setQueryData(['me'], user);
      const from = location.state?.from;
      navigate(from && from.startsWith('/app') ? from : '/app/today', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const strength =
    password.length === 0 ? 0 : password.length < 8 ? 1 : /[^a-zA-Z]/.test(password) && password.length >= 10 ? 3 : 2;

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex h-16 items-center px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2 rounded-md text-[15px] font-semibold tracking-tight">
          <LogoMark size={22} /> GoalMate
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-[6vh] pb-16">
        <div className="w-full max-w-[380px] animate-rise">
          <h1 className="text-center text-[26px] font-semibold tracking-[-0.025em]">
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-1.5 text-center text-[14px] text-fg-3">
            {isSignup ? 'Free, private, and your data stays on this server.' : 'Sign in to pick up where you left off.'}
          </p>

          <form onSubmit={submit} className="card mt-7 space-y-4 p-6">
            {isSignup && (
              <Field label="Name">
                <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required autoFocus />
              </Field>
            )}
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                autoFocus={!isSignup}
              />
            </Field>
            <Field label="Password">
              <div className="relative">
                <Input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  minLength={isSignup ? 8 : undefined}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-md text-fg-3 hover:text-fg"
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {isSignup && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-1 flex-1 rounded-full bg-surface-3 transition-colors"
                        style={
                          i <= strength
                            ? { background: ['', 'var(--danger)', 'var(--warning)', 'var(--success)'][strength] }
                            : undefined
                        }
                      />
                    ))}
                  </div>
                  <span className="w-24 text-right text-[11.5px] text-fg-3">
                    {['At least 8 characters', 'Too short', 'Good', 'Strong'][strength]}
                  </span>
                </div>
              )}
            </Field>
            {error && <p className="rounded-lg bg-danger/8 px-3 py-2 text-[13px] text-danger">{error}</p>}
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={loading}>
              {isSignup ? 'Create account' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-5 text-center text-[13px] text-fg-3">
            {isSignup ? 'Already have an account? ' : 'New here? '}
            <Link to={isSignup ? '/login' : '/signup'} className="font-medium text-accent hover:underline">
              {isSignup ? 'Sign in' : 'Create an account'}
            </Link>
          </p>

          <div className="my-6 flex items-center gap-3 text-[12px] text-fg-3">
            <div className="h-px flex-1 bg-line-strong" /> or <div className="h-px flex-1 bg-line-strong" />
          </div>
          <Button size="lg" className="w-full" onClick={demo.start} loading={demo.loading}>
            Explore the demo workspace <ArrowRight className="size-4" />
          </Button>
          <p className="mt-2 text-center text-[12px] text-fg-3">No sign-up. Filled with three months of sample data.</p>
        </div>
      </main>
    </div>
  );
}
