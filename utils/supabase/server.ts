// utils/supabase/server.ts - CORREÇÃO FINAL ESTÁVEL PARA NEXT.JS COOKIES BUG

// @ts-nocheck
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Função de leitura (para Server Components)
export function createClientReadOnly() {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    // Usando 'as any' para forçar a tipagem síncrona, contornando o bug do Next.js
                    return (cookies() as any).get(name)?.value;
                }
            },
        }
    );
}

// Função completa (para Server Actions e Route Handlers)
export function createClientFull() {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return (cookies() as any).get(name)?.value;
                },
                set(name: string, value: string, options: any) {
                    (cookies() as any).set({ name, value, ...options });
                },
                remove(name: string, options: any) {
                    (cookies() as any).set({
                        name,
                        value: '',
                        ...options,
                        maxAge: 0,
                    });
                },
            },
        }
    );
}