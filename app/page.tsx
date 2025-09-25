// app/page.tsx - Versão Autocontida com Login e Ações de Servidor

import { createClientReadOnly, createClientFull } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export default async function Page() {

  // 1. Verificação de Autenticação (Server Component, usa cliente somente leitura)
  const supabase = createClientReadOnly();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Se o usuário estiver logado, redireciona diretamente para o painel
    return redirect('/account');
  }

  // --- Server Action: Função de Login ---
  const signIn = async (formData: FormData) => {
    'use server';

    // Usa o cliente FULL para escrita de cookies de autenticação
    const supabase = createClientFull();

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Erro de Login:', error.message);
      // Em uma aplicação real, você deve retornar uma mensagem de erro para o frontend aqui.
      // Por enquanto, apenas logamos o erro.
      return;
    }

    return redirect('/account');
  };

  // --- Renderização do Componente React ---
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="p-8 bg-white shadow-xl rounded-lg w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Acesso Médico</h1>

        {/* O atributo 'action' chama a Server Action de login */}
        <form className="flex flex-col gap-4" action={signIn}>

          <input
            className="p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            name="email"
            type="email"
            placeholder="E-mail (CRM ou CPF da Memed)"
            required
          />
          <input
            className="p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            name="password"
            type="password"
            placeholder="Sua senha"
            required
          />
          <button
            className="p-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition duration-150"
            type="submit"
          >
            Entrar
          </button>
        </form>

      </div>
    </div>
  );
}