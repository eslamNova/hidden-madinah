"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { EditorContent, Extension, useEditor, type ChainedCommands, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { Placeholder } from "@tiptap/extensions";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Redo2,
  RemoveFormatting,
  TextQuote,
  Trash2,
  TriangleAlert,
  Underline,
  Undo2,
  Unlink,
  type LucideIcon,
} from "lucide-react";
import { isEditorLinkAllowed, normalizeEditorLink } from "@/lib/article-format";
import { isAllowedArticleImage } from "@/lib/article-images";
import type { Lang } from "@/lib/i18n";
import { droppedImages, useImageUpload, type UploadStatus } from "@/components/admin/image-upload";

/**
 * The article body editor: a Word-like toolbar over a TipTap editor, in the
 * site's own article typography (.article-body), right-to-left for Arabic and
 * left-to-right for English. It stores HTML, which the public page sanitises
 * again on the server (src/lib/article-html.ts) — the editor's schema already
 * holds only what that allowlist keeps: paragraphs, three heading sizes, bold,
 * italic, underline, lists, quotes, links, images and alignment. No free
 * fonts, colours or sizes.
 *
 * Images are uploaded to R2 (toolbar button, paste or drag-and-drop) and
 * inserted with their size; a selected image shows a field for its
 * description (alt text). Pasted HTML, and a stored body as it opens, keep
 * only images on the media domain or the site — what visitors will see.
 * Keyboard: the usual Ctrl/⌘ shortcuts (B, I, U, Z,
 * Shift+Z, K for a link, Alt+0/2/3/4 for the paragraph style, Shift+7/8 for
 * lists, Shift+B for a quote, Shift+L/E/R for alignment); arrow keys move
 * along the toolbar.
 */

type Props = {
  lang: Lang;
  /** HTML to start from (legacy Markdown is converted by the caller). */
  initialHtml: string;
  /** The body as HTML, "" when empty. */
  onChange: (html: string) => void;
  uploadsEnabled: boolean;
  /** Origins whose images may stay in pasted HTML (articleImageOrigins on the server). */
  imageOrigins: string[];
  /** id of the visible label naming the field. */
  labelledBy: string;
  describedBy?: string;
  hidden?: boolean;
};

/** Ctrl+K opens the link field (the toolbar's handler, passed in per editor). */
const LinkShortcut = Extension.create<{ open: () => void }>({
  name: "articleLinkShortcut",
  addOptions() {
    return { open: () => {} };
  },
  addKeyboardShortcuts() {
    return {
      "Mod-k": () => {
        this.options.open();
        return true;
      },
    };
  },
});

/**
 * Alignment as logical start / centre / end, so an Arabic paragraph's "start"
 * is its right edge. Ctrl+Shift+L and R align to the physical left and right
 * as in word processors, E centres; they are always handled, so the browser's
 * Ctrl+Shift+R (hard reload) can never fire inside the editor.
 */
function alignment(rtl: boolean) {
  return TextAlign.extend({
    addKeyboardShortcuts() {
      const toStart = () => this.editor.commands.unsetTextAlign() || true;
      const toEnd = () => this.editor.commands.setTextAlign("end") || true;
      return {
        "Mod-Shift-l": rtl ? toEnd : toStart,
        "Mod-Shift-r": rtl ? toStart : toEnd,
        "Mod-Shift-e": () => this.editor.commands.setTextAlign("center") || true,
      };
    },
  }).configure({ types: ["heading", "paragraph"], alignments: ["start", "center", "end"] });
}

/**
 * Removes images the public page would drop anyway (other sites, data: URLs,
 * local files) from pasted HTML and from a stored body as it opens, so the
 * editor never shows a picture visitors will not see.
 */
function keepOwnImages(html: string, origins: string[]): string {
  if (!/<img/i.test(html) || typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("img").forEach((img) => {
    if (!isAllowedArticleImage(img.getAttribute("src") ?? "", origins)) img.remove();
  });
  return doc.body.innerHTML;
}

const noSubscribe = () => () => {};
/** Shortcut labels: ⌘ on Apple devices, Ctrl elsewhere (Ctrl on the server render). */
function useModKey() {
  const mac = useSyncExternalStore(
    noSubscribe,
    () => /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent),
    () => false
  );
  return mac ? { label: "⌘", aria: "Meta" } : { label: "Ctrl", aria: "Control" };
}

type Mod = ReturnType<typeof useModKey>;

/** What the toolbar shows for the current selection. */
function toolbarState(e: Editor) {
  const image = e.isActive("image");
  return {
    bold: e.isActive("bold"),
    italic: e.isActive("italic"),
    underline: e.isActive("underline"),
    block: e.isActive("heading", { level: 2 })
      ? "2"
      : e.isActive("heading", { level: 3 })
        ? "3"
        : e.isActive("heading", { level: 4 })
          ? "4"
          : "p",
    bulletList: e.isActive("bulletList"),
    orderedList: e.isActive("orderedList"),
    blockquote: e.isActive("blockquote"),
    link: e.isActive("link"),
    center: e.isActive({ textAlign: "center" }),
    end: e.isActive({ textAlign: "end" }),
    canUndo: e.can().undo(),
    canRedo: e.can().redo(),
    image,
    imagePos: image ? e.state.selection.from : -1,
    imageAlt: image ? String(e.getAttributes("image").alt ?? "") : "",
  };
}

/** The editor's HTML for storage: "" when empty, without the trailing empty paragraph the editor keeps for the cursor. */
function storedHtml(e: Editor): string {
  return e.isEmpty ? "" : e.getHTML().replace(/(?:<p><\/p>)+$/, "");
}

function ToolButton({
  icon: Icon,
  label,
  keys,
  mod,
  active,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  /** e.g. ["Mod", "B"]; shown in the tooltip and announced as aria-keyshortcuts. */
  keys?: string[];
  mod: Mod;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const shown = keys?.map((k) => (k === "Mod" ? mod.label : k)).join("+");
  return (
    <button
      type="button"
      title={shown ? `${label} (${shown})` : label}
      aria-label={label}
      aria-keyshortcuts={keys?.map((k) => (k === "Mod" ? mod.aria : k)).join("+")}
      aria-pressed={active}
      disabled={disabled}
      // Keep the text selection in the editor while the button is pressed.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg disabled:opacity-40 ${
        active ? "bg-primary text-paper" : "text-ink hover:bg-ink/10"
      }`}
    >
      <Icon aria-hidden="true" className="h-5 w-5" />
    </button>
  );
}

const Separator = () => <span aria-hidden="true" className="mx-0.5 h-7 w-px shrink-0 bg-ink/15" />;

/** Progress and errors of an image upload, in Arabic (the editor's and the cover's). */
export function UploadNotice({ status }: { status: UploadStatus | null }) {
  const t = useTranslations("admin.articles.upload");
  if (!status) return null;
  if (status.state === "error") {
    return (
      <span className="flex items-start gap-2 font-semibold">
        <TriangleAlert aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-accent" />
        {t(`errors.${status.code}`)}
      </span>
    );
  }
  if (status.state === "done") {
    return (
      <span className="flex items-center gap-2 text-brand">
        <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
        {t("done")}
      </span>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" />
      {status.state === "preparing" ? t("preparing") : t("uploading", { percent: status.percent })}
      {status.state === "uploading" && (
        <progress max={100} value={status.percent} aria-hidden="true" className="h-2 w-32 accent-[#1F5C3D]" />
      )}
    </span>
  );
}

export function RichTextEditor({ lang, initialHtml, onChange, uploadsEnabled, imageOrigins, labelledBy, describedBy, hidden }: Props) {
  const t = useTranslations("admin.articles.editor");
  const uid = useId();
  const mod = useModKey();
  const rtl = lang === "ar";
  const dir = rtl ? "rtl" : "ltr";

  const fileRef = useRef<HTMLInputElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const altRef = useRef<HTMLInputElement>(null);
  const focusAltNext = useRef(false);
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const { status, busy, upload, report } = useImageUpload(uploadsEnabled);
  // Computed once (the editor reads it only when created); on the server it is the HTML as stored.
  const [startHtml] = useState(() => keepOwnImages(initialHtml, imageOrigins));

  // The editor is created once; its handlers reach the current props through refs.
  const onChangeRef = useRef(onChange);
  const openLinkRef = useRef<() => void>(() => {});
  const insertRef = useRef<(files: File[], at?: number) => void>(() => {});
  const originsRef = useRef(imageOrigins);
  useEffect(() => {
    onChangeRef.current = onChange;
    originsRef.current = imageOrigins;
  });

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        link: {
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          defaultProtocol: "https",
          HTMLAttributes: { rel: null, target: null, class: null },
          isAllowedUri: (url) => isEditorLinkAllowed(url),
        },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      alignment(rtl),
      Placeholder.configure({ placeholder: t(rtl ? "placeholderAr" : "placeholderEn") }),
      LinkShortcut.configure({ open: () => openLinkRef.current() }),
    ],
    content: startHtml,
    editorProps: {
      attributes: {
        id: `${uid}-content`,
        class: "article-body rich-editor",
        dir,
        lang,
        role: "textbox",
        "aria-multiline": "true",
        "aria-labelledby": labelledBy,
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
      },
      transformPastedHTML: (html) => keepOwnImages(html, originsRef.current),
      handlePaste: (_view, event) => {
        const files = droppedImages(event.clipboardData);
        if (!files.length) return false;
        event.preventDefault();
        insertRef.current(files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = droppedImages(event.dataTransfer);
        if (!files.length) return false;
        event.preventDefault();
        insertRef.current(files, view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos);
        return true;
      },
    },
    // The toolbar reflects every change of text or selection.
    shouldRerenderOnTransaction: true,
    onUpdate: ({ editor }) => onChangeRef.current(storedHtml(editor)),
  });

  // Re-rendered on every transaction (shouldRerenderOnTransaction), so this is always current.
  const state = editor ? toolbarState(editor) : null;

  const openLink = useCallback(() => {
    if (!editor) return;
    setLinkDraft(String(editor.getAttributes("link").href ?? ""));
    setLinkInvalid(false);
  }, [editor]);

  const closeLink = useCallback(
    (refocus = true) => {
      setLinkDraft(null);
      setLinkInvalid(false);
      if (refocus) editor?.commands.focus();
    },
    [editor]
  );

  const removeLink = useCallback(() => {
    editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    closeLink(false);
  }, [editor, closeLink]);

  const applyLink = () => {
    if (!editor || linkDraft === null) return;
    if (!linkDraft.trim()) return removeLink();
    const href = normalizeEditorLink(linkDraft);
    if (!href) {
      setLinkInvalid(true);
      linkInputRef.current?.focus();
      return;
    }
    if (editor.state.selection.empty && !editor.isActive("link")) {
      // Nothing selected: the address itself becomes the linked text.
      editor
        .chain()
        .focus()
        .insertContent({ type: "text", text: linkDraft.trim(), marks: [{ type: "link", attrs: { href } }] })
        .unsetMark("link")
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    closeLink(false);
  };

  const insertImages = useCallback(
    async (files: File[], at?: number) => {
      let target = at;
      for (const file of files) {
        const uploaded = await upload(file);
        if (!uploaded || !editor || editor.isDestroyed) return;
        const chain = editor.chain().focus();
        if (typeof target === "number") chain.setTextSelection(target);
        chain
          .setImage({
            src: uploaded.url,
            alt: "",
            ...(uploaded.width && uploaded.height ? { width: uploaded.width, height: uploaded.height } : {}),
          })
          .run();
        target = undefined;
        // Select the new picture so its description field opens, focused.
        let found = -1;
        editor.state.doc.descendants((node, pos) => {
          if (found === -1 && node.type.name === "image" && node.attrs.src === uploaded.url) found = pos;
          return found === -1;
        });
        if (found >= 0) {
          focusAltNext.current = true;
          editor.commands.setNodeSelection(found);
        }
      }
    },
    [editor, upload]
  );

  useEffect(() => {
    openLinkRef.current = openLink;
    insertRef.current = (files, at) => {
      if (!uploadsEnabled) return report("not_configured");
      void insertImages(files, at);
    };
  }, [openLink, insertImages, uploadsEnabled, report]);

  const linkOpen = linkDraft !== null;
  useEffect(() => {
    if (linkOpen) linkInputRef.current?.focus();
  }, [linkOpen]);

  useEffect(() => {
    if (state?.image && focusAltNext.current) {
      focusAltNext.current = false;
      altRef.current?.focus();
    }
  }, [state?.image, state?.imagePos]);

  const onToolbarKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    if ((e.target as HTMLElement).tagName === "SELECT") return;
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), select")];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (i === -1) return;
    e.preventDefault();
    const toolbarRtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const step = (e.key === "ArrowLeft") === toolbarRtl ? 1 : -1;
    const next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (i + step + items.length) % items.length;
    items[next]?.focus();
  };

  /** A toolbar command on the editor's current selection. */
  const run = (fn: (chain: ChainedCommands) => boolean) => {
    if (editor) fn(editor.chain().focus());
  };

  const pickImage = () => {
    if (!uploadsEnabled) return report("not_configured");
    fileRef.current?.click();
  };

  const AlignStartIcon = rtl ? AlignRight : AlignLeft;
  const AlignEndIcon = rtl ? AlignLeft : AlignRight;
  const ready = !!editor && !!state;

  return (
    <div
      hidden={hidden}
      className="rounded-2xl border-[1.5px] border-ink/30 bg-surface focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/40"
    >
      <div
        role="toolbar"
        aria-label={t("toolbar")}
        aria-controls={`${uid}-content`}
        onKeyDown={onToolbarKey}
        className="sticky top-0 z-20 flex flex-wrap items-center gap-1 rounded-t-2xl border-b border-ink/15 bg-surface/95 p-1.5 backdrop-blur"
      >
        <ToolButton icon={Undo2} label={t("undo")} keys={["Mod", "Z"]} mod={mod} disabled={!ready || !state?.canUndo} onClick={() => run((c) => c.undo().run())} />
        <ToolButton icon={Redo2} label={t("redo")} keys={["Mod", "Shift", "Z"]} mod={mod} disabled={!ready || !state?.canRedo} onClick={() => run((c) => c.redo().run())} />
        <Separator />
        <label htmlFor={`${uid}-block`} className="sr-only">
          {t("blockStyle")}
        </label>
        <select
          id={`${uid}-block`}
          value={state?.block ?? "p"}
          disabled={!ready}
          title={`${t("blockStyle")} (${mod.label}+Alt+0 / 2 / 3 / 4)`}
          onChange={(e) => {
            const v = e.target.value;
            run((c) => (v === "p" ? c.setParagraph() : c.setHeading({ level: Number(v) as 2 | 3 | 4 })).run());
          }}
          className="h-11 shrink-0 rounded-lg border border-ink/20 bg-surface px-2 text-base font-medium disabled:opacity-40"
        >
          <option value="p">{t("paragraph")}</option>
          <option value="2">{t("heading2")}</option>
          <option value="3">{t("heading3")}</option>
          <option value="4">{t("heading4")}</option>
        </select>
        <Separator />
        <ToolButton icon={Bold} label={t("bold")} keys={["Mod", "B"]} mod={mod} active={!!state?.bold} disabled={!ready} onClick={() => run((c) => c.toggleBold().run())} />
        <ToolButton icon={Italic} label={t("italic")} keys={["Mod", "I"]} mod={mod} active={!!state?.italic} disabled={!ready} onClick={() => run((c) => c.toggleItalic().run())} />
        <ToolButton icon={Underline} label={t("underline")} keys={["Mod", "U"]} mod={mod} active={!!state?.underline} disabled={!ready} onClick={() => run((c) => c.toggleUnderline().run())} />
        <Separator />
        <ToolButton icon={List} label={t("bulletList")} keys={["Mod", "Shift", "8"]} mod={mod} active={!!state?.bulletList} disabled={!ready} onClick={() => run((c) => c.toggleBulletList().run())} />
        <ToolButton icon={ListOrdered} label={t("orderedList")} keys={["Mod", "Shift", "7"]} mod={mod} active={!!state?.orderedList} disabled={!ready} onClick={() => run((c) => c.toggleOrderedList().run())} />
        <ToolButton icon={TextQuote} label={t("blockquote")} keys={["Mod", "Shift", "B"]} mod={mod} active={!!state?.blockquote} disabled={!ready} onClick={() => run((c) => c.toggleBlockquote().run())} />
        <Separator />
        <ToolButton icon={LinkIcon} label={t("link")} keys={["Mod", "K"]} mod={mod} active={!!state?.link || linkOpen} disabled={!ready} onClick={() => (linkOpen ? closeLink() : openLink())} />
        <ToolButton icon={Unlink} label={t("unlink")} mod={mod} disabled={!ready || !state?.link} onClick={removeLink} />
        <ToolButton icon={ImagePlus} label={t("image")} mod={mod} disabled={!ready || busy} onClick={pickImage} />
        <Separator />
        <ToolButton icon={AlignStartIcon} label={t("alignStart")} keys={["Mod", "Shift", rtl ? "R" : "L"]} mod={mod} active={ready && !state?.center && !state?.end} disabled={!ready} onClick={() => run((c) => c.unsetTextAlign().run())} />
        <ToolButton icon={AlignCenter} label={t("alignCenter")} keys={["Mod", "Shift", "E"]} mod={mod} active={!!state?.center} disabled={!ready} onClick={() => run((c) => c.setTextAlign("center").run())} />
        <ToolButton icon={AlignEndIcon} label={t("alignEnd")} keys={["Mod", "Shift", rtl ? "L" : "R"]} mod={mod} active={!!state?.end} disabled={!ready} onClick={() => run((c) => c.setTextAlign("end").run())} />
        <Separator />
        <ToolButton icon={RemoveFormatting} label={t("clear")} mod={mod} disabled={!ready} onClick={() => run((c) => c.unsetAllMarks().clearNodes().unsetTextAlign().run())} />
      </div>

      {linkOpen && (
        <div className="space-y-2 border-b border-ink/15 bg-sand/50 p-3">
          <label htmlFor={`${uid}-link`} className="block text-base font-semibold">
            {t("linkLabel")}
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              ref={linkInputRef}
              id={`${uid}-link`}
              type="text"
              dir="ltr"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={linkDraft ?? ""}
              aria-invalid={linkInvalid || undefined}
              aria-describedby={`${uid}-link-hint`}
              placeholder="https://…  /places/quba"
              onChange={(e) => {
                setLinkDraft(e.target.value);
                setLinkInvalid(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  closeLink();
                }
              }}
              className={`min-h-12 min-w-0 flex-1 basis-56 rounded-xl border-[1.5px] bg-surface px-3 text-base ${
                linkInvalid ? "border-accent ring-2 ring-accent" : "border-ink/30"
              }`}
            />
            <button type="button" onClick={applyLink} className="flex min-h-12 items-center rounded-xl bg-primary px-5 font-semibold text-paper">
              {t("linkApply")}
            </button>
            {state?.link && (
              <button type="button" onClick={removeLink} className="flex min-h-12 items-center rounded-xl border-[1.5px] border-ink/30 bg-surface px-4 font-medium">
                {t("unlink")}
              </button>
            )}
            <button type="button" onClick={() => closeLink()} className="flex min-h-12 items-center rounded-xl px-4 font-medium underline">
              {t("cancel")}
            </button>
          </div>
          <p id={`${uid}-link-hint`} className={`text-sm ${linkInvalid ? "font-semibold" : "text-muted"}`}>
            {linkInvalid ? t("linkInvalid") : t("linkHint")}
          </p>
        </div>
      )}

      {state?.image && (
        <div className="flex flex-wrap items-end gap-2 border-b border-ink/15 bg-sand/50 p-3">
          <div className="min-w-0 flex-1 basis-56">
            <label htmlFor={`${uid}-alt`} className="mb-1 block text-base font-semibold">
              {t("imageAlt")}
            </label>
            <input
              key={state.imagePos}
              ref={altRef}
              id={`${uid}-alt`}
              type="text"
              lang={lang}
              dir={dir}
              maxLength={300}
              defaultValue={state.imageAlt}
              aria-describedby={`${uid}-alt-hint`}
              onChange={(e) => {
                const pos = state.imagePos;
                editor?.chain().setNodeSelection(pos).updateAttributes("image", { alt: e.target.value }).setNodeSelection(pos).run();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") {
                  e.preventDefault();
                  editor?.commands.focus();
                }
              }}
              className="min-h-12 w-full rounded-xl border-[1.5px] border-ink/30 bg-surface px-3 text-base"
            />
          </div>
          <button
            type="button"
            onClick={() => editor?.chain().focus().setNodeSelection(state.imagePos).deleteSelection().run()}
            className="flex min-h-12 items-center gap-2 rounded-xl border-[1.5px] border-ink/30 bg-surface px-4 font-medium"
          >
            <Trash2 aria-hidden="true" className="h-5 w-5" />
            {t("imageRemove")}
          </button>
          <p id={`${uid}-alt-hint`} className="w-full text-sm text-muted">
            {t("imageAltHint")}
          </p>
        </div>
      )}

      <div role="status" aria-live="polite" className={status ? "border-b border-ink/15 px-3 py-2 text-sm" : "sr-only"}>
        <UploadNotice status={status} />
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) insertRef.current(files);
        }}
      />

      {editor ? (
        <EditorContent editor={editor} />
      ) : (
        <div aria-hidden="true" className="article-body rich-editor text-muted" dir={dir}>
          …
        </div>
      )}
    </div>
  );
}
