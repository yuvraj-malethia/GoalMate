/**
 * The Notion-style editor used for journal entries and task notes.
 *
 * Built on BlockNote (a block editor on top of ProseMirror/Tiptap): headings,
 * to-do lists, toggles, quotes, code, tables, drag handles and "/" commands
 * come from BlockNote. GoalMate adds its own "/" commands (AI writing help and
 * "Today's tasks"), autosave, and theming to match the rest of the app.
 *
 * This file is loaded lazily (see LazyEditor) because the editor is the
 * heaviest part of the bundle and most pages don't need it.
 */
import '@blocknote/mantine/style.css';
import { useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { filterSuggestionItems } from '@blocknote/core';
import { en } from '@blocknote/core/locales';
import { BlockNoteView } from '@blocknote/mantine';
import { getDefaultReactSlashMenuItems, SuggestionMenuController, useCreateBlockNote } from '@blocknote/react';
import { useQueryClient } from '@tanstack/react-query';
import { ListChecks, ListTodo, Lightbulb, PenLine, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { api, ApiError, errorMessage, qs } from '@/lib/api';
import { todayKey } from '@/lib/dates';
import { useIsDark } from '@/lib/store';
import { cn } from '@/lib/utils';

const AI_LABELS = {
  continue: 'Continuing your writing',
  summarize: 'Summarising the page',
  prompts: 'Writing reflection questions',
  actions: 'Pulling out action items',
  improve: 'Rewriting the selection',
};

export default function PageEditor({ page, onStatus, className, handleRef }) {
  const dark = useIsDark();
  const qc = useQueryClient();

  const editor = useCreateBlockNote({
    initialContent: page.content.length ? page.content : undefined,
    dictionary: {
      ...en,
      placeholders: {
        ...en.placeholders,
        emptyDocument: 'Start writing, or press “/” for blocks and AI',
        default: 'Press “/” for commands',
      },
    },
  });

  /* ---------------- autosave ---------------- */
  const dirty = useRef(false);
  const timer = useRef(undefined);
  const statusRef = useRef(onStatus);
  statusRef.current = onStatus;

  const save = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    const content = editor.document;
    statusRef.current?.('saving');
    try {
      const saved = await api.patch(`/pages/${page.id}`, { content });
      qc.setQueryData(['page', page.id], { ...saved, content });
      qc.invalidateQueries({ queryKey: ['pages'] });
      qc.invalidateQueries({ queryKey: ['task'] });
      statusRef.current?.(dirty.current ? 'unsaved' : 'saved');
    } catch {
      dirty.current = true;
      statusRef.current?.('error');
    }
  }, [editor, page.id, qc]);

  const onChange = () => {
    dirty.current = true;
    statusRef.current?.('unsaved');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(save, 700);
  };

  // Save when leaving the page or hiding the tab.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && dirty.current) {
        dirty.current = false;
        fetch(`/api/pages/${page.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: editor.document }),
          keepalive: true,
        });
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      save();
    };
  }, [editor, page.id, save]);

  /* ---------------- AI + custom commands ---------------- */

  const insertMarkdown = useCallback(
    async (markdown, heading) => {
      // Models sometimes write "[ ] item" without the list marker; Markdown needs "- [ ] item" for a checkbox.
      const normalized = markdown.replace(/^\s*(?:[-*]\s+)?\[( |x|X)\]\s+/gm, (_m, c) => `- [${c.toLowerCase()}] `);
      const blocks = await Promise.resolve(editor.tryParseMarkdownToBlocks(normalized));
      const toInsert = heading ? [{ type: 'heading', props: { level: 3 }, content: heading }, ...blocks] : blocks;
      let ref;
      try {
        ref = editor.getTextCursorPosition().block;
      } catch {
        ref = editor.document[editor.document.length - 1];
      }
      const refEmpty = ref && Array.isArray(ref.content) && ref.content.length === 0 && ref.type === 'paragraph';
      if (refEmpty) editor.replaceBlocks([ref], toInsert);
      else editor.insertBlocks(toInsert, ref ?? editor.document[editor.document.length - 1], 'after');
    },
    [editor],
  );

  const runAi = useCallback(
    async (action) => {
      await save(); // the server reads the saved text
      let selection;
      if (action === 'improve') {
        selection = editor.getSelectedText();
        if (!selection.trim()) {
          toast('Select some text first, then choose “Improve writing”.');
          return;
        }
      }
      const id = toast.loading(`${AI_LABELS[action]}…`);
      try {
        const { markdown } = await api.post('/ai/write', { pageId: page.id, action, selection });
        if (action === 'improve') {
          editor.insertInlineContent(markdown.trim());
        } else {
          await insertMarkdown(
            markdown,
            action === 'summarize'
              ? 'Summary'
              : action === 'prompts'
                ? 'Questions to reflect on'
                : action === 'actions'
                  ? 'Next actions'
                  : undefined,
          );
        }
        toast.success('Done', { id, duration: 1200 });
      } catch (e) {
        const setup = e instanceof ApiError && e.isAiSetup;
        toast.error(setup ? 'AI is switched off' : 'AI request failed', {
          id,
          description: setup ? 'Add GEMINI_API_KEY to the server’s .env file.' : errorMessage(e),
        });
      }
    },
    [editor, insertMarkdown, page.id, save],
  );

  const insertTodayTasks = useCallback(async () => {
    const today = todayKey();
    const tasks = await api.get(`/tasks${qs({ from: today, to: today, overdueBefore: today })}`);
    if (!tasks.length) {
      toast('Nothing is scheduled for today.');
      return;
    }
    await insertMarkdown(
      tasks.map((t) => `- [${t.completedAt ? 'x' : ' '}] ${t.title}${t.goal ? ` — ${t.goal.title}` : ''}`).join('\n'),
      'Today’s tasks',
    );
  }, [insertMarkdown]);

  useImperativeHandle(
    handleRef,
    () => ({
      runAi,
      insertTodayTasks,
      flush: save,
      toMarkdown: async () => Promise.resolve(editor.blocksToMarkdownLossy(editor.document)),
    }),
    [runAi, insertTodayTasks, save, editor],
  );

  const getItems = useCallback(
    async (query) => {
      const custom = [
        {
          title: 'Continue writing',
          subtext: 'AI continues from where the page ends',
          aliases: ['ai', 'write', 'continue'],
          group: 'AI',
          icon: <PenLine size={18} />,
          onItemClick: () => runAi('continue'),
        },
        {
          title: 'Summarize page',
          subtext: 'AI adds a short summary',
          aliases: ['ai', 'summary', 'tldr'],
          group: 'AI',
          icon: <Sparkles size={18} />,
          onItemClick: () => runAi('summarize'),
        },
        {
          title: 'Reflection questions',
          subtext: 'AI suggests questions to go deeper',
          aliases: ['ai', 'prompts', 'reflect', 'questions'],
          group: 'AI',
          icon: <Lightbulb size={18} />,
          onItemClick: () => runAi('prompts'),
        },
        {
          title: 'Action items',
          subtext: 'AI turns this page into a checklist',
          aliases: ['ai', 'todo', 'actions', 'next'],
          group: 'AI',
          icon: <ListChecks size={18} />,
          onItemClick: () => runAi('actions'),
        },
        {
          title: 'Today’s tasks',
          subtext: 'Insert today’s tasks as a checklist',
          aliases: ['today', 'tasks', 'agenda', 'plan'],
          group: 'GoalMate',
          icon: <ListTodo size={18} />,
          onItemClick: () => insertTodayTasks(),
        },
      ];
      return filterSuggestionItems([...getDefaultReactSlashMenuItems(editor), ...custom], query);
    },
    [editor, runAi, insertTodayTasks],
  );

  return (
    <div className={cn('gm-editor', className)}>
      <BlockNoteView editor={editor} theme={dark ? 'dark' : 'light'} onChange={onChange} slashMenu={false}>
        <SuggestionMenuController triggerCharacter="/" getItems={getItems} />
      </BlockNoteView>
    </div>
  );
}
