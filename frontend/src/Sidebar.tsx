import type { Editor as TiptapEditor } from "@tiptap/react";

import { AiSidebar } from "./AiSidebar";
import { CommentsPanel } from "./CommentsPanel";
import type { MeOut } from "./api";

export type SidebarTab = "ia" | "comments" | "suggestions";

export function Sidebar({
  token,
  docId,
  editor,
  me,
  canEdit,
  tab,
  onTab,
  activeMarkId,
  draftMarkId,
  onDraftDone,
  onOpenDoc,
}: {
  token: string;
  docId: string;
  editor: TiptapEditor | null;
  me: MeOut;
  canEdit: boolean;
  tab: SidebarTab;
  onTab: (t: SidebarTab) => void;
  activeMarkId: string | null;
  draftMarkId: string | null;
  onDraftDone: () => void;
  onOpenDoc: (id: string) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        <button className={tab === "ia" ? "active" : ""} onClick={() => onTab("ia")}>
          IA
        </button>
        <button
          className={tab === "comments" ? "active" : ""}
          onClick={() => onTab("comments")}
          disabled={!docId}
          title={docId ? "Comentários do documento" : "Abra um documento"}
        >
          Comentários
        </button>
        {/* aba Sugestões entra na Task 7 (só canEdit) */}
      </div>
      {tab === "ia" && <AiSidebar token={token} onOpenDoc={onOpenDoc} />}
      {tab === "comments" && docId && (
        <CommentsPanel
          token={token}
          docId={docId}
          editor={editor}
          me={me}
          canEdit={canEdit}
          activeMarkId={activeMarkId}
          draftMarkId={draftMarkId}
          onDraftDone={onDraftDone}
        />
      )}
    </aside>
  );
}
