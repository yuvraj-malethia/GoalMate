import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, Download, KeyRound, Monitor, Moon, Sun, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/AppShell';
import { AiSetupNotice } from '@/components/Chat';
import { Button } from '@/components/ui/Button';
import { Field, Input, Segmented } from '@/components/ui/Controls';
import { Kbd } from '@/components/ui/misc';
import { Modal } from '@/components/ui/Overlay';
import { api, errorMessage } from '@/lib/api';
import { invalidatePages, invalidateWork, useAiStatus, useMe } from '@/lib/queries';
import { useUi } from '@/lib/store';
import { cn, downloadJson, modKey } from '@/lib/utils';

const ACCENTS = [
  { value: 'blue', color: '#0a7aff', label: 'Blue' },
  { value: 'purple', color: '#9b4dca', label: 'Purple' },
  { value: 'pink', color: '#e0306a', label: 'Pink' },
  { value: 'orange', color: '#e87a00', label: 'Orange' },
  { value: 'green', color: '#28a745', label: 'Green' },
  { value: 'graphite', color: '#6e6e73', label: 'Graphite' },
];

function Section({ title, description, children }) {
  return (
    <section className="grid gap-4 border-b border-line py-8 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 className="text-[14px] font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-[12.5px] text-fg-3">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export function SettingsPage() {
  const { data: me } = useMe();
  const { theme, setTheme, accent, setAccent } = useUi();
  if (!me) return null;

  return (
    <>
      <PageHeader title="Settings" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 pb-24 sm:px-8">
          <Section title="Profile" description={me.isDemo ? 'This is a temporary demo account.' : 'How you appear in GoalMate.'}>
            <ProfileForm me={me} />
          </Section>

          {!me.isDemo && (
            <Section title="Password" description="At least 8 characters.">
              <PasswordForm />
            </Section>
          )}

          <Section title="Appearance" description="Follows your system by default.">
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-[12.5px] font-medium text-fg-2">Theme</p>
                <Segmented
                  value={theme}
                  onChange={setTheme}
                  options={[
                    {
                      value: 'system',
                      label: (
                        <>
                          <Monitor className="size-3.5" /> System
                        </>
                      ),
                    },
                    {
                      value: 'light',
                      label: (
                        <>
                          <Sun className="size-3.5" /> Light
                        </>
                      ),
                    },
                    {
                      value: 'dark',
                      label: (
                        <>
                          <Moon className="size-3.5" /> Dark
                        </>
                      ),
                    },
                  ]}
                />
              </div>
              <div>
                <p className="mb-2 text-[12.5px] font-medium text-fg-2">Accent colour</p>
                <div className="flex flex-wrap gap-3">
                  {ACCENTS.map((a) => (
                    <button
                      key={a.value}
                      onClick={() => setAccent(a.value)}
                      className="flex flex-col items-center gap-1.5 text-[11.5px] text-fg-3"
                      aria-pressed={accent === a.value}
                    >
                      <span
                        className={cn(
                          'grid size-7 place-items-center rounded-full transition-transform hover:scale-105',
                          accent === a.value && 'ring-2 ring-offset-2 ring-offset-surface',
                        )}
                        style={{ background: a.color, ['--tw-ring-color']: a.color }}
                      >
                        {accent === a.value && <span className="size-2 rounded-full bg-white" />}
                      </span>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Section title="AI" description="GoalMate uses Google Gemini for plans, coaching and reviews.">
            <AiStatusCard />
          </Section>

          <Section
            title="Your data"
            description="Export everything as JSON, or import a file — including exports from the original GoalMate."
          >
            <DataTools />
          </Section>

          <Section title="Keyboard">
            <ul className="space-y-2 text-[13px]">
              {[
                [`${modKey === '⌘' ? '⌘' : 'Ctrl'} K`, 'Search and commands'],
                ['/', 'Block menu and AI inside any journal page'],
                ['Enter', 'Add the task you are typing'],
                ['Esc', 'Close panels and dialogs'],
              ].map(([k, d]) => (
                <li key={k} className="flex items-center justify-between gap-4 border-b border-line pb-2 last:border-0">
                  <span className="text-fg-2">{d}</span>
                  <Kbd>{k}</Kbd>
                </li>
              ))}
            </ul>
          </Section>

          {!me.isDemo && (
            <Section title="Delete account" description="Permanently removes your account and everything in it.">
              <DeleteAccount />
            </Section>
          )}
        </div>
      </div>
    </>
  );
}

function ProfileForm({ me }) {
  const qc = useQueryClient();
  const [name, setName] = useState(me.name);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const u = await api.patch('/auth/me', { name });
      qc.setQueryData(['me'], u);
      toast.success('Profile saved');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="grid max-w-md gap-4">
      <Field label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      {!me.isDemo && (
        <Field label="Email">
          <Input value={me.email} disabled />
        </Field>
      )}
      <div>
        <Button variant="primary" onClick={save} loading={saving} disabled={!name.trim() || name === me.name}>
          Save
        </Button>
      </div>
    </div>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await api.post('/auth/password', { current, next });
      setCurrent('');
      setNext('');
      toast.success('Password changed');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="grid max-w-md gap-4">
      <Field label="Current password">
        <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
      </Field>
      <Field label="New password">
        <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
      </Field>
      <div>
        <Button onClick={save} loading={saving} disabled={!current || next.length < 8}>
          <KeyRound className="size-3.5" /> Change password
        </Button>
      </div>
    </div>
  );
}

function AiStatusCard() {
  const { data: status, refetch, isFetching } = useAiStatus();
  if (!status) return null;
  if (!status.configured) return <AiSetupNotice />;
  return (
    <div className="card p-4 text-[13px]">
      <div className="flex items-start gap-3">
        {status.lastError ? (
          <CircleAlert className="mt-0.5 size-4 text-warning" />
        ) : (
          <CheckCircle2 className="mt-0.5 size-4 text-success" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium">{status.lastError ? 'API key found, but the last request failed' : 'Connected to Gemini'}</p>
          {status.lastError && <p className="mt-0.5 text-fg-3">{status.lastError}</p>}
          <p className="mt-1 text-fg-3">
            {status.lastModel ? `Last answer came from ${status.lastModel}. ` : ''}
            Models tried in order: {status.models.join(' → ')}.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => refetch()} loading={isFetching}>
          Refresh
        </Button>
      </div>
    </div>
  );
}

function DataTools() {
  const qc = useQueryClient();
  const input = useRef(null);
  const [busy, setBusy] = useState(null);

  const doExport = async () => {
    setBusy('export');
    try {
      const data = await api.get('/data/export');
      downloadJson(data, `goalmate-export-${new Date().toISOString().slice(0, 10)}.json`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const doImport = async (file) => {
    setBusy('import');
    try {
      const json = JSON.parse(await file.text());
      const res = await api.post('/data/import', json);
      invalidateWork(qc);
      invalidatePages(qc);
      toast.success(`Imported ${res.goals} goals and ${res.pages} pages`);
    } catch (e) {
      toast.error(e instanceof SyntaxError ? 'That file is not valid JSON.' : errorMessage(e));
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={doExport} loading={busy === 'export'}>
        <Download className="size-3.5" /> Export JSON
      </Button>
      <Button onClick={() => input.current?.click()} loading={busy === 'import'}>
        <Upload className="size-3.5" /> Import JSON
      </Button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
      />
      <p className="w-full text-[12px] text-fg-3">Imports always add new items; nothing existing is overwritten.</p>
    </div>
  );
}

function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const qc = useQueryClient();
  const navigate = useNavigate();
  const remove = async () => {
    try {
      await api.del('/auth/me');
      qc.clear();
      navigate('/');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Delete your account?"
        description="Goals, tasks, journal pages and chats are deleted immediately. This can’t be undone."
      >
        <div className="space-y-4 px-5 pb-5">
          <Field label='Type "delete" to confirm'>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoFocus />
          </Field>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="danger" disabled={confirm !== 'delete'} onClick={remove}>
              Delete account
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
