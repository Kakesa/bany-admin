import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Node as TiptapNode, mergeAttributes } from '@tiptap/core';
import { NodeSelection, Plugin } from '@tiptap/pm/state';
import { isHistoryTransaction } from '@tiptap/pm/history';
import { Fragment, Slice, type Node as PmNode } from '@tiptap/pm/model';
import type { EditorView } from '@tiptap/pm/view';
import { Bold, Italic, List, ListOrdered, Underline as UnderlineIcon } from 'lucide-react';

export const MERGE_TAG_LABELS: Record<string, string> = {
  firstName: 'Prénom',
  siteUrl: 'Lien du site',
  unsubscribeUrl: 'Désinscription',
  title: 'Titre',
  excerpt: 'Extrait',
  articleUrl: 'Lien de l’article',
  subject: 'Sujet',
  message: 'Message',
};

export const CAMPAIGN_MERGE_TOKENS = ['firstName', 'siteUrl', 'unsubscribeUrl'];

export const TEMPLATE_MERGE_TOKENS: Record<string, string[]> = {
  welcome: ['firstName', 'siteUrl'],
  article: ['title', 'excerpt', 'articleUrl'],
  announcement: ['subject', 'message', 'siteUrl'],
  custom: ['firstName', 'siteUrl', 'unsubscribeUrl'],
};

const MERGE_HREF = /\{\{\s*[a-zA-Z0-9_]+\s*\}\}/;
const MERGE_IN_TEXT = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function tokensForTemplate(category: string, subject: string, html: string) {
  const defaults = TEMPLATE_MERGE_TOKENS[category] || TEMPLATE_MERGE_TOKENS.custom;
  const found = Array.from(`${subject}\n${html}`.matchAll(MERGE_IN_TEXT), (match) => match[1]);
  return Array.from(new Set([...defaults, ...found]));
}

export function decorateEmailHtml(html: string) {
  return html
    .replace(/<p>(\s*)<a\b([^>]*)>([\s\S]*?)<\/a>(\s*)<\/p>/gi, (full, _pre, attrs: string, label: string) => {
      const hrefMatch = attrs.match(/href="([^"]*)"/i);
      if (!hrefMatch) return full;
      return `<p style="margin:28px 0"><a href="${hrefMatch[1]}" style="display:inline-block;background:#ef3b3b;color:#fff;text-decoration:none;padding:12px 18px;font-weight:700">${label}</a></p>`;
    })
    .replace(/<h2(\s[^>]*)?>/gi, (open: string) => {
      if (/style=/i.test(open)) return open;
      return open.replace('<h2', '<h2 style="color:#fff;font-size:20px;margin:12px 0"');
    });
}

function mergeLabel(token: string) {
  return MERGE_TAG_LABELS[token] || token;
}

export function storedToEditorHtml(html: string) {
  if (!html.trim() || typeof DOMParser === 'undefined') return html;
  const doc = new DOMParser().parseFromString(`<div id="email-root">${html}</div>`, 'text/html');
  const root = doc.getElementById('email-root');
  if (!root) return html;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    textNodes.push(current as Text);
    current = walker.nextNode();
  }
  for (const textNode of textNodes) {
    if (!textNode.data.includes('{{')) continue;
    const fragment = doc.createDocumentFragment();
    const pattern = new RegExp(MERGE_IN_TEXT.source, 'g');
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(textNode.data))) {
      if (match.index > last) fragment.append(textNode.data.slice(last, match.index));
      const chip = doc.createElement('span');
      chip.setAttribute('data-merge-tag', match[1]);
      fragment.append(chip);
      last = match.index + match[0].length;
    }
    if (last < textNode.data.length) fragment.append(textNode.data.slice(last));
    textNode.parentNode?.replaceChild(fragment, textNode);
  }
  return root.innerHTML;
}

export function editorHtmlToStored(html: string) {
  const withTokens = html.replace(
    /<span\b[^>]*\bdata-merge-tag="([a-zA-Z0-9_]+)"[^>]*>[\s\S]*?<\/span>/gi,
    '{{$1}}'
  );
  return withTokens === '<p></p>' ? '' : withTokens;
}

const MergeTag = TiptapNode.create({
  name: 'mergeTag',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      token: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-merge-tag'),
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-merge-tag]' }];
  },

  renderHTML({ node }) {
    const token = String(node.attrs.token || '');
    return [
      'span',
      mergeAttributes({
        'data-merge-tag': token,
        class: 'email-merge-chip',
        contenteditable: 'false',
      }),
      mergeLabel(token),
    ];
  },

  addProseMirrorPlugins() {
    const countTags = (doc: PmNode) => {
      let total = 0;
      doc.descendants((node) => {
        if (node.type.name === 'mergeTag') total += 1;
      });
      return total;
    };

    return [
      new Plugin({
        filterTransaction(transaction) {
          if (!transaction.docChanged) return true;
          if (transaction.getMeta('preventUpdate') || isHistoryTransaction(transaction)) return true;
          if (transaction.getMeta('allowMergeDelete')) return true;
          return countTags(transaction.doc) >= countTags(transaction.before);
        },
        props: {
          handleKeyDown(view, event) {
            if (event.key !== 'Backspace' && event.key !== 'Delete') return false;
            const { selection } = view.state;
            if (selection instanceof NodeSelection && selection.node.type.name === 'mergeTag') {
              view.dispatch(view.state.tr.deleteSelection().setMeta('allowMergeDelete', true));
              return true;
            }
            if (!selection.empty) {
              let includesTag = false;
              view.state.doc.nodesBetween(selection.from, selection.to, (node) => {
                if (node.type.name === 'mergeTag') includesTag = true;
              });
              return includesTag;
            }
            const { $from } = selection;
            if (event.key === 'Backspace' && $from.nodeBefore?.type.name === 'mergeTag') return true;
            if (event.key === 'Delete' && $from.nodeAfter?.type.name === 'mergeTag') return true;
            return false;
          },
          handleTextInput(view, from, to, text) {
            if (!/[{}]/.test(text)) return false;
            const clean = text.replace(/[{}]/g, '');
            if (clean) view.dispatch(view.state.tr.insertText(clean, from, to));
            return true;
          },
          handlePaste(view, event) {
            const text = event.clipboardData?.getData('text/plain');
            if (text == null) return false;
            event.preventDefault();
            insertTextWithMergeTags(view, text);
            return true;
          },
        },
      }),
    ];
  },
});

function insertTextWithMergeTags(view: EditorView, text: string) {
  const { schema } = view.state;
  const nodes: PmNode[] = [];
  const pattern = new RegExp(MERGE_IN_TEXT.source, 'g');
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const chunk = text.slice(last, match.index).replace(/[{}]/g, '');
    if (chunk) nodes.push(schema.text(chunk));
    if (schema.nodes.mergeTag) nodes.push(schema.nodes.mergeTag.create({ token: match[1] }));
    last = match.index + match[0].length;
  }
  const rest = text.slice(last).replace(/[{}]/g, '');
  if (rest) nodes.push(schema.text(rest));
  if (!nodes.length) return;
  view.dispatch(view.state.tr.replaceSelection(new Slice(Fragment.from(nodes), 0, 0)));
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`p-1.5 transition cursor-pointer ${
        active ? 'bg-rose-500 text-stone-950' : 'text-stone-400 hover:text-stone-100 hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  );
}

function TokenButtons({ tokens, onInsert }: { tokens: string[]; onInsert: (token: string) => void }) {
  if (!tokens.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-stone-600 mr-1">Insérer</span>
      {tokens.map((token) => (
        <button
          key={token}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onInsert(token)}
          className="email-merge-chip cursor-pointer"
        >
          {mergeLabel(token)}
        </button>
      ))}
    </div>
  );
}

const editorStyles = `
  .email-merge-chip {
    display: inline-flex;
    align-items: center;
    margin: 0 0.15rem;
    padding: 0 0.45rem;
    border-radius: 999px;
    background: rgba(244, 63, 94, 0.16);
    color: #fda4af;
    font-size: 0.75rem;
    font-weight: 650;
    line-height: 1.6;
    user-select: none;
    vertical-align: baseline;
  }
  .email-body-editor .ProseMirror-selectednode.email-merge-chip {
    outline: 1px solid #fb7185;
  }
  .email-body-editor .tiptap p.is-editor-empty:first-child::before {
    color: rgba(255, 255, 255, 0.35);
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }
  .email-subject[data-empty="true"]::before {
    content: attr(data-placeholder);
    color: rgba(255, 255, 255, 0.35);
  }
`;

export function MergeSubjectField({
  value,
  onChange,
  placeholder,
  tokens,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  tokens: string[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const emitted = useRef<string | null>(null);

  const publish = () => {
    if (!ref.current) return;
    const next = readSubject(ref.current);
    ref.current.dataset.empty = next ? 'false' : 'true';
    emitted.current = next;
    onChange(next);
  };

  useEffect(() => {
    if (!ref.current || value === emitted.current) return;
    fillSubject(ref.current, value);
    emitted.current = value;
  }, [value]);

  const insertToken = (token: string) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const chip = createChip(token);
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && el.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0);
      if (!selectionExactlyOneChip(el) && rangeContainsChip(range)) return;
      range.deleteContents();
      range.insertNode(chip);
      range.setStartAfter(chip);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      el.append(chip);
    }
    publish();
  };

  return (
    <div className="space-y-2">
      <div
        ref={ref}
        className="email-subject w-full bg-transparent border-b border-white/10 py-3 text-sm text-stone-200 focus:outline-none focus:border-rose-500/50 whitespace-nowrap overflow-x-auto"
        contentEditable
        role="textbox"
        aria-label={placeholder || 'Sujet'}
        data-placeholder={placeholder || 'Sujet de l’email'}
        suppressContentEditableWarning
        onInput={publish}
        onKeyDown={(event) => {
          const el = ref.current;
          if (!el) return;
          if (event.key === 'Enter' || event.key === '{' || event.key === '}') {
            event.preventDefault();
            return;
          }
          if (event.key !== 'Backspace' && event.key !== 'Delete') return;
          if (selectionExactlyOneChip(el)) return;
          const selection = window.getSelection();
          if (selection && !selection.isCollapsed && selection.rangeCount > 0 && rangeContainsChip(selection.getRangeAt(0))) {
            event.preventDefault();
            return;
          }
          if (event.key === 'Backspace' && adjacentChip(el, 'before')) event.preventDefault();
          if (event.key === 'Delete' && adjacentChip(el, 'after')) event.preventDefault();
        }}
        onPaste={(event) => {
          event.preventDefault();
          const el = ref.current;
          if (!el) return;
          const selection = window.getSelection();
          if (selection && !selection.isCollapsed && selection.rangeCount > 0 && rangeContainsChip(selection.getRangeAt(0))) {
            return;
          }
          insertPlainAtCaret(el, event.clipboardData.getData('text/plain').replace(/\s+/g, ' '));
          publish();
        }}
      />
      <TokenButtons tokens={tokens} onInsert={insertToken} />
      <style>{editorStyles}</style>
    </div>
  );
}

function createChip(token: string) {
  const chip = document.createElement('span');
  chip.dataset.mergeTag = token;
  chip.contentEditable = 'false';
  chip.className = 'email-merge-chip';
  chip.textContent = mergeLabel(token);
  return chip;
}

function fillSubject(el: HTMLElement, value: string) {
  el.replaceChildren();
  const pattern = new RegExp(MERGE_IN_TEXT.source, 'g');
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    if (match.index > last) el.append(document.createTextNode(value.slice(last, match.index)));
    el.append(createChip(match[1]));
    last = match.index + match[0].length;
  }
  if (last < value.length) el.append(document.createTextNode(value.slice(last)));
  el.dataset.empty = value ? 'false' : 'true';
}

function readSubject(el: HTMLElement) {
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent || '').replace(/[{}]/g, '');
    if (node instanceof HTMLElement && node.dataset.mergeTag) return `{{${node.dataset.mergeTag}}}`;
    let text = '';
    node.childNodes.forEach((child) => {
      text += walk(child);
    });
    return text;
  };
  return walk(el).replace(/[ \t]*\n[ \t]*/g, ' ');
}

function insertPlainAtCaret(el: HTMLElement, text: string) {
  const selection = window.getSelection();
  const fragment = document.createDocumentFragment();
  const pattern = new RegExp(MERGE_IN_TEXT.source, 'g');
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const chunk = text.slice(last, match.index).replace(/[{}]/g, '');
    if (chunk) fragment.append(document.createTextNode(chunk));
    fragment.append(createChip(match[1]));
    last = match.index + match[0].length;
  }
  const rest = text.slice(last).replace(/[{}]/g, '');
  if (rest) fragment.append(document.createTextNode(rest));
  if (!selection || selection.rangeCount === 0 || !el.contains(selection.anchorNode)) {
    el.append(fragment);
    return;
  }
  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(fragment);
  range.collapse(false);
}

function rangeContainsChip(range: Range) {
  const fragment = range.cloneContents();
  return Boolean(fragment.querySelector('[data-merge-tag]'));
}

function selectionExactlyOneChip(el: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false;
  const range = selection.getRangeAt(0);
  if (!el.contains(range.commonAncestorContainer)) return false;
  const fragment = range.cloneContents();
  const chips = fragment.querySelectorAll('[data-merge-tag]');
  return chips.length === 1 && fragment.childNodes.length === 1;
}

function adjacentChip(el: HTMLElement, direction: 'before' | 'after') {
  const selection = window.getSelection();
  if (!selection || !selection.isCollapsed || !selection.anchorNode || !el.contains(selection.anchorNode)) return false;
  const node = selection.anchorNode;
  const offset = selection.anchorOffset;
  if (node.nodeType === Node.TEXT_NODE) {
    const sibling = direction === 'before'
      ? (offset === 0 ? node.previousSibling : null)
      : (offset === (node.textContent || '').length ? node.nextSibling : null);
    return sibling instanceof HTMLElement && Boolean(sibling.dataset.mergeTag);
  }
  if (node instanceof HTMLElement) {
    const child = direction === 'before' ? node.childNodes[offset - 1] : node.childNodes[offset];
    return child instanceof HTMLElement && Boolean(child.dataset.mergeTag);
  }
  return false;
}

export default function EmailContentEditor({
  value,
  onChange,
  tokens,
  placeholder = 'Écrivez le message…',
}: {
  value: string;
  onChange: (html: string) => void;
  tokens: string[];
  placeholder?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        trailingNode: false,
        link: {
          openOnClick: false,
          autolink: false,
          linkOnPaste: false,
          isAllowedUri: (url: string) => MERGE_HREF.test(url) || /^https?:\/\//i.test(url) || /^mailto:/i.test(url),
        },
      }),
      Placeholder.configure({ placeholder }),
      MergeTag,
    ],
    content: storedToEditorHtml(value || ''),
    editorProps: {
      attributes: {
        class:
          'tiptap min-h-[180px] max-h-[420px] overflow-y-auto px-4 py-3 focus:outline-none text-stone-200 text-sm leading-relaxed [&_h2]:text-xl [&_h2]:text-stone-100 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:text-stone-100 [&_h3]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_a]:text-rose-300 [&_a]:underline',
      },
    },
    onUpdate: ({ editor: current }) => {
      onChange(editorHtmlToStored(current.getHTML()));
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editorHtmlToStored(editor.getHTML());
    const next = value || '';
    if (next !== current) {
      editor.commands.setContent(storedToEditorHtml(next), { emitUpdate: false });
    }
  }, [value, editor]);

  const setLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes('link').href as string | undefined;
    if (previous && MERGE_HREF.test(previous)) return;
    const url = window.prompt('URL du lien', previous || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    if (/[{}]/.test(url) || !/^(https?:\/\/|mailto:)/i.test(url)) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="email-body-editor border border-white/10 bg-stone-950/40 focus-within:border-rose-500/40 transition">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-white/5 p-2 bg-stone-900/60">
        {editor && (
          <>
            <ToolbarButton title="Gras" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
              <Bold className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Italique" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
              <Italic className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Souligné" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
              <UnderlineIcon className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Liste" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
              <List className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Liste numérotée" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
              <ListOrdered className="w-3.5 h-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Lien" active={editor.isActive('link')} onClick={setLink}>
              <span className="text-[11px] font-semibold px-0.5">Lien</span>
            </ToolbarButton>
            <span className="w-px h-4 bg-white/10 mx-1" />
          </>
        )}
        <TokenButtons
          tokens={tokens}
          onInsert={(token) => editor?.chain().focus().insertContent({ type: 'mergeTag', attrs: { token } }).run()}
        />
      </div>
      <p className="px-3 py-1.5 text-[11px] text-stone-600 border-b border-white/5">
        Les pastilles restent entières. Pour en retirer une, cliquez dessus puis appuyez sur Suppr.
      </p>
      <EditorContent editor={editor} />
      <style>{editorStyles}</style>
    </div>
  );
}
