import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY が設定されていません。.env.local を確認してください。"
  );
}

/**
 * RLSをバイパスするsecret keyを使用するサーバー専用クライアント。
 * API Routes以外（クライアントコンポーネント等）からは絶対にimportしないこと。
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false },
});
