// components/LogoutButton.tsx
'use client';

import { createClient } from '@/utils/supabase/client';
import { redirect } from 'next/navigation';

export default function LogoutButton() {
    const signOut = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        // Força o redirecionamento para a página de login após o logout
        window.location.href = '/';
    };

    return (
        <button
            onClick={signOut}
            className="py-2 px-4 rounded-md no-underline bg-red-600 text-white hover:bg-red-700 font-medium transition"
        >
            Sair
        </button>
    );
}