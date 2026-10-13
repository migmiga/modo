import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 둘 중 하나라도 비어 있으면(아직 Supabase 설정 전) null — createClient가
// 빈 URL로 즉시 던지는 것보다, 호출부(GoogleLoginButton/authSync)가 "아직
// 연결 안 됨"으로 조용히 처리할 수 있게 한다. 기존 게스트 화면은 이 값과
// 무관하게 그대로 동작한다.
export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null;
