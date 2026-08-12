import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Undo,
  Redo,
  Pilcrow,
  ImagePlus,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Upload un fichier et retourne l’URL publique de l’image */
  onUploadImage?: (file: File) => Promise<string>;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`p-1.5 transition cursor-pointer disabled:opacity-30 ${
        active ? 'bg-rose-500 text-stone-950' : 'text-stone-400 hover:text-stone-100 hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Écrivez votre article…',
  onUploadImage,
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-rose-400 underline' },
      }),
      Placeholder.configure({ placeholder }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Image.configure({
        allowBase64: false,
        HTMLAttributes: {
          class: 'editor-inline-image',
        },
      }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class:
          'tiptap prose-blog min-h-[220px] max-h-[420px] overflow-y-auto px-4 py-3 focus:outline-none text-stone-200 text-sm leading-relaxed [&_h1]:text-2xl [&_h1]:font-display [&_h1]:text-stone-100 [&_h1]:mb-3 [&_h2]:text-xl [&_h2]:font-display [&_h2]:text-stone-100 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-display [&_h3]:text-stone-100 [&_h3]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_a]:text-rose-400 [&_img]:max-w-full [&_img]:h-auto [&_img]:my-4 [&_img]:border [&_img]:border-white/10',
      },
      handleDrop: (view, event) => {
        if (!onUploadImage) return false;
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
        if (!imageFiles.length) return false;
        event.preventDefault();
        void (async () => {
          setUploadingImage(true);
          try {
            for (const file of imageFiles) {
              const url = await onUploadImage(file);
              const { schema } = view.state;
              const node = schema.nodes.image.create({ src: url, alt: file.name });
              const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
              const tr = view.state.tr;
              if (typeof pos === 'number') {
                tr.insert(pos, node);
              } else {
                tr.replaceSelectionWith(node);
              }
              view.dispatch(tr);
            }
          } catch {
            /* parent montre l’erreur via onUploadImage */
          } finally {
            setUploadingImage(false);
          }
        })();
        return true;
      },
      handlePaste: (view, event) => {
        if (!onUploadImage) return false;
        const items = event.clipboardData?.items;
        if (!items) return false;
        const imageItems = Array.from(items).filter((i) => i.type.startsWith('image/'));
        if (!imageItems.length) return false;
        event.preventDefault();
        void (async () => {
          setUploadingImage(true);
          try {
            for (const item of imageItems) {
              const file = item.getAsFile();
              if (!file) continue;
              const url = await onUploadImage(file);
              const { schema } = view.state;
              const node = schema.nodes.image.create({ src: url, alt: file.name });
              const tr = view.state.tr.replaceSelectionWith(node);
              view.dispatch(tr);
            }
          } catch {
            /* ignore */
          } finally {
            setUploadingImage(false);
          }
        })();
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      onChange(html === '<p></p>' ? '' : html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const normalizedCurrent = current === '<p></p>' ? '' : current;
    const next = value || '';
    if (next !== normalizedCurrent) {
      editor.commands.setContent(next || '', { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL du lien', previous || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const insertImageFromUrl = () => {
    const url = window.prompt('URL de l’image', 'https://');
    if (!url?.trim()) return;
    editor.chain().focus().setImage({ src: url.trim() }).run();
  };

  const openImagePicker = () => {
    if (onUploadImage) {
      fileInputRef.current?.click();
      return;
    }
    insertImageFromUrl();
  };

  const handleImageFile = async (file: File | undefined) => {
    if (!file || !onUploadImage) return;
    setUploadingImage(true);
    try {
      const url = await onUploadImage(file);
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } catch {
      /* parent */
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="border border-white/10 bg-stone-950/40 focus-within:border-rose-500/40 transition">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-white/5 p-2 bg-stone-900/60">
        <ToolbarButton
          title="Paragraphe"
          active={editor.isActive('paragraph') && !editor.isActive('heading')}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <Pilcrow className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Titre 1 (grand)"
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Titre 2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Titre 3"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="w-3.5 h-3.5" />
        </ToolbarButton>

        <span className="w-px h-4 bg-white/10 mx-1" />

        <ToolbarButton
          title="Gras"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Italique"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Souligné"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="w-3.5 h-3.5" />
        </ToolbarButton>

        <span className="w-px h-4 bg-white/10 mx-1" />

        <ToolbarButton
          title="Liste à puces"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Liste numérotée"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </ToolbarButton>

        <span className="w-px h-4 bg-white/10 mx-1" />

        <ToolbarButton
          title="Aligner à gauche"
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Centrer"
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Aligner à droite"
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight className="w-3.5 h-3.5" />
        </ToolbarButton>

        <span className="w-px h-4 bg-white/10 mx-1" />

        <ToolbarButton title="Lien" active={editor.isActive('link')} onClick={setLink}>
          <LinkIcon className="w-3.5 h-3.5" />
        </ToolbarButton>

        <ToolbarButton
          title={uploadingImage ? 'Upload…' : 'Insérer une image'}
          disabled={uploadingImage}
          active={editor.isActive('image')}
          onClick={openImagePicker}
        >
          <ImagePlus className="w-3.5 h-3.5" />
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleImageFile(e.target.files?.[0])}
        />

        <span className="w-px h-4 bg-white/10 mx-1" />

        <ToolbarButton
          title="Annuler"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo className="w-3.5 h-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Rétablir"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo className="w-3.5 h-3.5" />
        </ToolbarButton>
      </div>

      {uploadingImage && (
        <p className="px-4 py-1.5 text-[11px] text-stone-500 font-body border-b border-white/5">
          Téléversement de l’image…
        </p>
      )}

      <EditorContent editor={editor} />

      <style>{`
        .tiptap p.is-editor-empty:first-child::before {
          color: rgba(255, 255, 255, 0.35);
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .tiptap:focus {
          outline: none;
        }
        .tiptap img.editor-inline-image,
        .tiptap img {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 1rem 0;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .tiptap img.ProseMirror-selectednode {
          outline: 2px solid #f43f5e;
        }
      `}</style>
    </div>
  );
}
