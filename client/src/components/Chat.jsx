import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUp, KeyRound, RotateCcw, Sparkles, Square, Trash2 } from 'lucide-react';

import { api, ApiError, errorMessage, streamChat } from '@/lib/api';
import { useAiStatus, useThread } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { Button } from './ui/Button';
import { Spinner } from './ui/misc';

export function Markdown({ children, className }) {
  return (
    <div className={cn('prose-chat text-[13.5px]', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: (props) => <a {...props} target="_blank" rel="noreferrer" /> }}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** Shown wherever an AI feature can't run because the server has no (valid) Gemini key. */
export function AiSetupNotice({ message, compact }) {
  return (
    <div className={cn('rounded-xl border border-dashed border-line-strong bg-surface-2 text-[13px]', compact ? 'p-3' : 'p-4')}>
      <div className="flex items-start gap-3">
        <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-fg-2">
          <KeyRound className="size-4" />
        </div>
        <div>
          <p className="font-medium">AI features are switched off</p>
          <p className="mt-0.5 text-fg-3">
            {message ?? 'The server has no Gemini API key.'} Get a free key from{' '}
            <a
              className="text-accent underline underline-offset-2"
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
            >
              Google AI Studio
            </a>
            , put it in <code className="rounded bg-surface-3 px-1 font-mono text-[12px]">.env</code> as{' '}
            <code className="rounded bg-surface-3 px-1 font-mono text-[12px]">GEMINI_API_KEY</code>, and restart the server.
          </p>
        </div>
      </div>
    </div>
  );
}

export function AiBadge({ className }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium text-fg-3', className)}>
      <Sparkles className="size-3" /> Gemini
    </span>
  );
}

/**
 * A conversation with the AI coach, scoped to a "thread" (a task, a journal
 * page or a goal). The server adds that thing's context to every question and
 * stores the history, so the conversation is still there next time.
 */
export function ChatPanel({ thread, suggestions, intro, className, onMessagesChange }) {
  const qc = useQueryClient();
  const { data: status } = useAiStatus();
  const { data: messages = [], isLoading } = useThread(thread);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(null);
  const abort = useRef(null);
  const scroller = useRef(null);
  const streaming = !!pending && !pending.error && !pending.setupError;

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, pending?.answer, pending?.error]);

  useEffect(() => () => abort.current?.abort(), []);

  const send = async (text) => {
    const q = text.trim();
    if (!q || streaming) return;
    setInput('');
    setPending({ question: q, answer: '' });
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const { error, messages: saved } = await streamChat(
        thread,
        q,
        (delta) => setPending((p) => (p ? { ...p, answer: p.answer + delta } : p)),
        ctrl.signal,
      );
      // Swap the streaming bubble for the stored messages in the same render.
      qc.setQueryData(['thread', thread], (old = []) => [...old, ...saved]);
      // Stopped early: the server kept the partial answer, so fetch it.
      if (!saved.length) qc.invalidateQueries({ queryKey: ['thread', thread] });
      setPending((p) => (error && p ? { ...p, error } : null));
      onMessagesChange?.();
    } catch (e) {
      const setup = e instanceof ApiError && e.isAiSetup;
      setPending((p) =>
        p ? { ...p, error: setup ? undefined : errorMessage(e), setupError: setup ? errorMessage(e) : undefined } : p,
      );
      if (setup) qc.invalidateQueries({ queryKey: ['ai-status'] });
    }
  };

  const clear = async () => {
    await api.del(`/ai/threads/${thread}`);
    setPending(null);
    qc.setQueryData(['thread', thread], []);
    onMessagesChange?.();
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(input);
    }
  };

  const notConfigured = status && !status.configured;
  const empty = !isLoading && messages.length === 0 && !pending;

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {notConfigured && <AiSetupNotice compact />}
        {isLoading && (
          <div className="grid place-items-center py-10 text-fg-3">
            <Spinner />
          </div>
        )}
        {empty && !notConfigured && (
          <div className="px-1 pt-2">
            <div className="mb-3 flex items-center gap-2 text-[13px] font-medium">
              <span className="grid size-6 place-items-center rounded-md bg-accent/10 text-accent">
                <Sparkles className="size-3.5" />
              </span>
              Coach
            </div>
            <p className="text-[13px] text-fg-3">{intro}</p>
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} role={m.role} text={m.content} />
        ))}
        {pending && (
          <>
            {/* After an error the server has already stored whatever arrived, so only the error bar remains. */}
            {!pending.error && <Bubble role="user" text={pending.question} />}
            {pending.setupError ? (
              <AiSetupNotice compact message={pending.setupError} />
            ) : (
              !pending.error && <Bubble role="model" text={pending.answer} streaming={streaming} />
            )}
            {pending.error && (
              <div className="flex items-center gap-2 rounded-lg bg-danger/8 px-3 py-2 text-[12.5px] text-danger">
                <span className="flex-1">{pending.error}</span>
                <Button size="sm" variant="ghost" onClick={() => send(pending.question)}>
                  <RotateCcw className="size-3.5" /> Retry
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t border-line px-3 pt-2.5 pb-3">
        {(empty || messages.length === 0) && !notConfigured && (
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={streaming}
                className="rounded-full border border-line-strong bg-surface px-2.5 py-1 text-[12px] text-fg-2 hover:border-accent/50 hover:text-fg"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 rounded-xl border border-line-strong bg-surface px-3 py-2 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15 dark:bg-surface-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            rows={1}
            disabled={notConfigured}
            placeholder={notConfigured ? 'AI is not configured' : 'Ask anything about this…'}
            aria-label="Message the coach"
            className="max-h-32 min-h-[22px] flex-1 resize-none bg-transparent text-[13.5px] leading-[22px] outline-none placeholder:text-fg-3 [field-sizing:content]"
          />
          {streaming ? (
            <button
              aria-label="Stop"
              onClick={() => abort.current?.abort()}
              className="grid size-7 place-items-center rounded-full bg-fg text-bg"
            >
              <Square className="size-3" fill="currentColor" />
            </button>
          ) : (
            <button
              aria-label="Send"
              onClick={() => send(input)}
              disabled={!input.trim() || notConfigured}
              className="grid size-7 place-items-center rounded-full bg-accent text-white transition-opacity disabled:opacity-30"
            >
              <ArrowUp className="size-4" strokeWidth={2.5} />
            </button>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between px-1">
          <span className="text-[11px] text-fg-3">AI can be wrong. Check anything important.</span>
          {messages.length > 0 && (
            <button onClick={clear} className="inline-flex items-center gap-1 text-[11px] text-fg-3 hover:text-danger">
              <Trash2 className="size-3" /> Clear chat
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Bubble({ role, text, streaming }) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-[13.5px] whitespace-pre-wrap text-white">
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5">
      <div className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-surface-3 text-fg-2">
        <Sparkles className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        {text ? (
          <Markdown className={cn(streaming && '[&>*:last-child]:typing-caret')}>{text}</Markdown>
        ) : (
          <div className="flex h-6 items-center gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-1.5 animate-pulse rounded-full bg-fg-3" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
