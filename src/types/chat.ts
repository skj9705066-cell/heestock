export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  stockSymbol?: string;
  stockName?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  stockSymbol?: string;
  stockName?: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StreamChunk {
  type: "text" | "done" | "error";
  content?: string;
  error?: string;
}
