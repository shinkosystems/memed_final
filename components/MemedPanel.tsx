// components/MemedPanel.tsx - Corrigido para inicialização robusta

'use client';

import { useEffect } from 'react';

// Define a interface global para os objetos injetados pela Memed
declare global {
    interface Window {
        MdSinapsePrescricao?: {
            event: {
                add: (eventName: string, callback: (module: { name: string }) => void) => void;
            };
        };
        MdHub?: {
            module: {
                show: (moduleName: string, options: { container: string, source?: string }) => void;
            };
        };
    }
}

// URL do script da Memed
const MEMED_SCRIPT_URL = 'https://integrations.memed.com.br/modulos/plataforma.sinapse-prescricao/build/sinapse-prescricao.min.js';

export default function MemedPanel({ token }: { token: string }) {

    // Função para tentar exibir o módulo. Usada após o carregamento e em re-renderizações.
    const showMemedModule = () => {
        // Verifica se o MdHub existe e tenta injetar o módulo
        if (window.MdHub?.module) {
            console.log("Tentando exibir módulo da Memed no container 'memed-container'");
            window.MdHub.module.show('plataforma.prescricao', {
                container: 'memed-container',
                // Opcional: Adicionar a origem do seu sistema
                source: 'seu_sistema_aqui'
            });
            return true; // Sucesso
        }
        return false; // Falha
    };

    useEffect(() => {
        if (!token) {
            console.error("Token da Memed não fornecido. Interrompendo o carregamento.");
            return;
        }

        // 1. Tenta re-exibir o módulo se o script JÁ estiver carregado
        if (document.querySelector(`script[src="${MEMED_SCRIPT_URL}"]`)) {
            // Se já carregado, tenta mostrar o módulo. O token já está no data-attribute do script.
            console.log("Script da Memed já carregado. Tentando mostrar módulo.");
            showMemedModule();
            return;
        }

        // 2. Se o script AINDA NÃO existe, cria e anexa
        const script = document.createElement('script');
        script.src = MEMED_SCRIPT_URL;
        script.dataset.token = token; // Passa o token de autorização via data-attribute
        script.async = true;

        script.addEventListener('load', () => {
            // Este evento dispara APENAS quando o arquivo .js foi baixado e executado.
            console.log("Script da Memed carregado. Tentando adicionar listeners.");

            // A. Adiciona o listener principal para inicialização do core
            if (typeof window.MdSinapsePrescricao !== 'undefined') {
                window.MdSinapsePrescricao.event.add('core:moduleInit', (module: { name: string }) => {
                    if (module.name === 'plataforma.prescricao') {
                        console.log("Evento 'core:moduleInit' disparado. Exibindo o módulo.");
                        // B. Injeta o módulo APÓS a confirmação da inicialização do core
                        showMemedModule();
                    }
                });
            }

            // C. Chama showMemedModule() imediatamente após o load, como fallback para o caso de
            // o evento 'core:moduleInit' já ter disparado antes do nosso listener ser anexado.
            showMemedModule();
        });

        document.body.appendChild(script);

        // Cleanup: Remove o script ao desmontar o componente, embora para a Memed não seja estritamente necessário
        return () => {
            // Opcional: remover o script se for necessário lidar com tokens de usuários diferentes na mesma sessão.
            // const existingScript = document.querySelector(`script[src="${MEMED_SCRIPT_URL}"]`);
            // if (existingScript) {
            //     document.body.removeChild(existingScript);
            // }
        };

    }, [token]);

    // O componente renderiza apenas o container vazio
    return (
        <div id="memed-container" className="w-full h-full">
            <div className="flex justify-center items-center h-full text-gray-500">
                Carregando Painel da Memed... (Token: {token ? 'Presente' : 'Ausente'})
            </div>
        </div>
    );
}