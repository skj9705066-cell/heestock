"use client";

import { Clock, MessageSquare, Trash2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatSession } from "@/types/chat";
import { Badge } from "@/components/ui/Badge";

interface ChatHistoryProps {
  sessions: ChatSession[];
  activeSessionId?: string;
  onSelect: (session: ChatSession) => void;
  onDelete: (id: string) => void;
}

export function ChatHistory({
  sessions,
  activeSessionId,
  onSelect,
  onDelete,
}: ChatHistoryProps) {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">대화 기록이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {sessions.map((session) => (
        <div
          key={session.id}
          className={cn(
            "flex items-start gap-2 p-3 rounded-lg cursor-pointer group transition-all",
            "hover:bg-slate-50 dark:hover:bg-slate-800/50",
            activeSessionId === session.id &&
              "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
          )}
          onClick={() => onSelect(session)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              {session.stockName && (
                <Badge
                  variant={
                    session.messages[0]?.stockName ? "blue" : "neutral"
                  }
                  size="sm"
                >
                  {session.stockSymbol}
                </Badge>
              )}
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                {session.title}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <span className="text-xs text-slate-400">
                {session.messages.length}개 메시지
              </span>
              <Clock className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <span className="text-xs text-slate-400">
                {new Date(session.updatedAt).toLocaleDateString("ko-KR", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(session.id);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-all flex-shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
