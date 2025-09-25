// utils/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';
// import { Database } from './database.types'; // Se você estiver usando tipos

export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}