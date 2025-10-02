// app/account/page.tsx - VERSÃO FINAL: Tenta GET -> Tenta POST (Payload Memed Completo) -> Tenta GET (Retry)

import { createClientReadOnly } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import MemedPanel from '@/components/MemedPanel';
import process from 'process';
import LogoutButton from '@/components/LogoutButton';

// Interface para o corpo da resposta da API da Memed
interface MemedTokenResponse {
    token: string;
}

// Assinatura para a função de obtenção de token
type GetTokenResult = { token: string; id: string } | { error: string; id: string };

// --- Variáveis de Ambiente ---
const MEMED_API_URL = process.env.MEMED_API_URL || '';
const API_KEY = process.env.MEMED_API_KEY || '';
const SECRET_KEY = process.env.MEMED_SECRET_KEY || '';

if (!API_KEY || !SECRET_KEY || !MEMED_API_URL) {
    console.error("Erro de Configuração: Chaves da Memed ausentes.");
    throw new Error("Erro de Configuração: Chaves da Memed ausentes.");
}

// --- Funções de API da Memed ---

async function getAccessToken(id_usuario: string): Promise<GetTokenResult> {
    const url = `${MEMED_API_URL}/usuarios/${id_usuario}?api-key=${API_KEY}&secret-key=${SECRET_KEY}`;
    console.log("Memed API URL Acessada (GET):", url);

    const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
    });

    if (response.ok) {
        const data: MemedTokenResponse = await response.json();
        if (data.token) {
            return { token: data.token, id: id_usuario };
        }
        return { error: "Resposta da Memed não continha o campo 'token'.", id: id_usuario };
    }

    const errorText = await response.text();
    const status = response.status;

    let detail = 'Detalhe do erro indisponível.';
    try {
        const responseData = JSON.parse(errorText);
        detail = responseData.errors?.[0]?.detail || responseData.detail || detail;
    } catch (e) {
        detail = errorText.substring(0, 100) + (errorText.length > 100 ? '...' : '');
    }

    console.error(`Erro ao obter token da Memed (Status: ${status}):`, detail);

    return { error: `Status ${status}: ${detail}`, id: id_usuario };
}

async function createPrescriber(userData: any, userEmail: string): Promise<boolean> {
    const cleaned_crm = userData.crm.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const cleaned_cpf = userData.cpf ? userData.cpf.replace(/[^0-9]/g, '') : undefined;

    // LÓGICA DE DIVISÃO DO NOME
    const fullNameParts = userData.nome.trim().split(/\s+/);
    const firstName = fullNameParts.length > 0 ? fullNameParts[0] : userData.nome;
    const lastName = fullNameParts.length > 1 ? fullNameParts.slice(1).join(' ') : '-';

    const url = `${MEMED_API_URL}/sinapse-prescricao/usuarios?api-key=${API_KEY}&secret-key=${SECRET_KEY}`;
    console.log("Memed API URL Acessada (POST - Cadastro):", url);

    const payload = {
        data: {
            type: "usuarios",
            attributes: {
                external_id: userData.id, // UUID
                nome: firstName,
                sobrenome: lastName,
                cpf: cleaned_cpf,
                board: {
                    board_code: "CRM",
                    board_number: cleaned_crm,
                    board_state: userData.crm_state,
                },
                email: userEmail,
            },

            // ESTRUTURA RELATIONSHIPS EXIGIDA PELA MEMED
            relationships: {
                cidade: {
                    data: {
                        type: "cidades",
                        id: userData.cidade_id_memed,
                    }
                },
                especialidade: {
                    data: {
                        type: "especialidades",
                        id: userData.especialidade_id_memed,
                    }
                }
            }
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.api+json',
            'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(payload),
        cache: 'no-store',
    });

    if (response.status === 201) {
        console.log("Usuário prescritor cadastrado com SUCESSO! (Status 201)");
        return true;
    }

    // 409 Conflict (já existe) ou 400 (CPF já existe)
    if (response.status === 409 || response.status === 400) {
        console.log(`Usuário já existe na base da Memed. (Status ${response.status})`);
        return true;
    }

    const errorText = await response.text();
    console.error(`Falha no cadastro Memed (Status ${response.status}):`, errorText);
    return false;
}


export default async function AccountPage() {
    const supabase = createClientReadOnly();

    // 1. Autenticação e obtenção do user.id (UUID) e email
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return redirect('/');
    }

    // --- PASSO 2: BUSCAR TODOS OS DADOS NECESSÁRIOS (COM OS NOVOS CAMPOS) ---
    const { data: userData, error: userError } = await supabase
        .from('users')
        // Adicionamos os campos exigidos pela Memed
        .select('nome, crm, crm_state, cpf, cidade_id_memed, especialidade_id_memed')
        .eq('id', user.id)
        .single();

    if (userError || !userData?.crm || !userData?.nome || !userData?.crm_state || !userData?.cidade_id_memed || !userData?.especialidade_id_memed) {
        console.error("Erro ao buscar dados do usuário na tabela de perfil:", userError);
        return (
            <div className="p-8 text-center text-red-600">
                **Erro de Dados:** Falha ao carregar dados de perfil. Verifique se os campos **CRM, Nome, Estado, cidade_id_memed** e **especialidade_id_memed** estão preenchidos na tabela `users`.
            </div>
        );
    }

    // Usaremos o UUID como o ID de usuário prescritor (external_id)
    const id_prescritor_memed = encodeURIComponent(user.id);
    let display_id = id_prescritor_memed;


    let memedToken: string | null = null;
    let finalError: string | null = null;

    // --- FLUXO 3: TENTA GET (1ª TENTATIVA) ---
    let result = await getAccessToken(id_prescritor_memed);

    if ('error' in result) {
        // Se o erro for 404 ou outro, tentamos cadastrar.
        if (result.error.includes("Status 404") || result.error.includes("O ID enviado não existe")) {
            console.log("Tentando cadastrar o prescritor com payload completo...");

            // --- FLUXO 4: TENTA POST (CADASTRO) ---
            const creationData = { ...userData, id: user.id };
            const creationSuccess = await createPrescriber(creationData, user.email!);

            if (creationSuccess) {
                console.log("Cadastro OK. Tentando GET novamente (retry)...");

                // --- FLUXO 5: TENTA GET (2ª TENTATIVA) ---
                result = await getAccessToken(id_prescritor_memed);

                if ('error' in result) {
                    finalError = `Falha após cadastro: ${result.error}`;
                } else {
                    memedToken = result.token;
                }
            } else {
                finalError = "Falha crítica ao cadastrar o usuário na Memed. (Veja log do servidor)";
            }
        } else {
            // Outros erros na 1ª tentativa
            finalError = result.error;
        }
    } else {
        memedToken = result.token;
    }


    // --- FLUXO 6: EXIBIÇÃO DE ERRO FINAL OU PAINEL ---
    if (finalError || !memedToken) {
        return (
            <div className="flex flex-col items-center justify-center p-8 min-h-screen bg-gray-50">
                <div className="p-8 bg-white shadow-xl rounded-lg w-full max-w-lg text-center border-t-4 border-red-500">
                    <h2 className="text-2xl font-bold text-red-700 mb-4">Falha na Integração Memed</h2>
                    <p className="text-red-800 font-semibold">{finalError || "Não foi possível obter o token após o cadastro."}</p>
                    <p className="mt-4 text-sm text-gray-700">ID Testado: **{display_id}**</p>
                    <p className="mt-1 text-sm text-gray-700">O problema agora é 99% a ativação do ID pela Memed (Status 404 ou 401).</p>
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
                Bem-vindo(a), **{user.email}**! Seu **ID Externo (UUID)** usado na Memed é: **{display_id}**
            </p>

            <div className="w-full max-w-7xl h-[85vh] border rounded-lg shadow-xl overflow-hidden bg-white">
                <MemedPanel token={memedToken} />
            </div>

        </div>
    );
}