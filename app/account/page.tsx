// app/account/page.tsx - Versão Simplificada FINAL (GET com UUID)

import { createClientReadOnly } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import MemedPanel from '@/components/MemedPanel';
import process from 'process';
import LogoutButton from '@/components/LogoutButton';

// Interface para o corpo da resposta da API da Memed
interface MemedTokenResponse {
    token: string;
}

const MEMED_API_URL = process.env.MEMED_API_URL;
const API_KEY = process.env.MEMED_API_KEY;
const SECRET_KEY = process.env.MEMED_SECRET_KEY;

export default async function AccountPage() {
    const supabase = createClientReadOnly();

    // 1. Autenticação e obtenção do user.id (UUID)
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return redirect('/');
    }

    if (!API_KEY || !SECRET_KEY || !MEMED_API_URL) {
        return <div className="p-8 text-center text-red-600">Erro de Configuração: Chaves da Memed ausentes no .env.local.</div>;
    }

    // Usaremos o UUID como o ID de usuário prescritor (external_id)
    const id_usuario_memed = encodeURIComponent(user.id);
    const display_id = user.id; // Apenas para exibição

    let memedToken: string | null = null;
    let finalError: string | null = null;

    try {
        // 2. Fazer a requisição GET para obter o Token de Acesso da Memed
        const url = `${MEMED_API_URL}/usuarios/${id_usuario_memed}?api-key=${API_KEY}&secret-key=${SECRET_KEY}`;

        console.log("Memed API URL Acessada (GET - UUID):", url);

        const response = await fetch(url, {
            method: 'GET',
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorText = await response.text();

            let detail = 'Detalhe do erro indisponível.';
            try {
                const responseData = JSON.parse(errorText);
                detail = responseData.errors?.[0]?.detail || responseData.detail || `Status ${response.status}`;
            } catch (e) {
                detail = errorText.substring(0, 100) + (errorText.length > 100 ? '...' : '');
            }

            finalError = `Status ${response.status}: ${detail}`;
            console.error("Erro ao obter token da Memed:", finalError);
        } else {
            const data: MemedTokenResponse = await response.json();
            memedToken = data.token;

            if (!memedToken) {
                finalError = "A resposta da Memed não continha o campo 'token'.";
            }
        }

    } catch (error) {
        finalError = "Erro interno ao tentar autenticar na Memed. (Veja o console do servidor)";
        console.error("Erro fatal na integração com Memed:", error);
    }

    // --- EXIBIÇÃO DE ERRO FINAL OU PAINEL ---
    if (finalError || !memedToken) {
        return (
            <div className="flex flex-col items-center justify-center p-8 min-h-screen bg-gray-50">
                <div className="p-8 bg-white shadow-xl rounded-lg w-full max-w-lg text-center border-t-4 border-red-500">
                    <h2 className="text-2xl font-bold text-red-700 mb-4">Falha na Integração Memed</h2>
                    <p className="text-red-800 font-semibold">{finalError || "Token não recebido."}</p>
                    <p className="mt-4 text-sm text-gray-700">Tentativa com UUID/ID Externo: **{display_id}**</p>
                    <p className="mt-1 text-sm text-gray-700">O cadastro foi realizado, mas a Memed ainda não reconhece o ID externo para gerar o token.</p>
                </div>
            </div>
        );
    }

    // --- SUCESSO ---
    return (
        <div className="flex flex-col items-center p-8 min-h-screen">
            <div className="w-full max-w-7xl flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Painel de Prescrições (Memed)</h1>
                <LogoutButton />
            </div>

            <p className="mb-4 text-gray-600">
                Bem-vindo(a), **{user.email}**! Seu **ID Interno (UUID)** usado na Memed é: **{display_id}**
            </p>

            <div className="w-full max-w-7xl h-[85vh] border rounded-lg shadow-xl overflow-hidden bg-white">
                <MemedPanel token={memedToken} />
            </div>

        </div>
    );
}