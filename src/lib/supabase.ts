import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function saveChatSession(session: {
  id: string;
  title: string;
  stockSymbol?: string;
  stockName?: string;
  messages: object[];
}) {
  const { data, error } = await supabase
    .from("chat_sessions")
    .upsert({
      id: session.id,
      title: session.title,
      stock_symbol: session.stockSymbol,
      stock_name: session.stockName,
      messages: session.messages,
      updated_at: new Date().toISOString(),
    })
    .select();

  if (error) console.error("Failed to save chat session:", error);
  return data;
}

export async function getChatSessions() {
  const { data, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) console.error("Failed to fetch chat sessions:", error);
  return data || [];
}

export async function deleteChatSession(id: string) {
  const { error } = await supabase
    .from("chat_sessions")
    .delete()
    .eq("id", id);

  if (error) console.error("Failed to delete chat session:", error);
}
