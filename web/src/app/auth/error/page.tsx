'use client';

import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut, AlertTriangle } from 'lucide-react';
import { signOut } from '@/app/actions/auth';
import { Suspense } from 'react';

function AuthErrorContent() {
    const searchParams = useSearchParams();
    const reason = searchParams.get('reason');

    let title = 'Erro de Autenticação';
    let message = 'Ocorreu um erro ao tentar acessar o sistema.';

    if (reason === 'missing_profile') {
        title = 'Perfil Não Encontrado';
        message = 'Sua conta de usuário existe, mas não foi encontrado um perfil associado. Isso geralmente acontece quando o usuário é criado manualmente sem os dados de perfil.';
    }

    return (
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-zinc-200 p-8 text-center">
            <div className="mx-auto w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>

            <h1 className="text-xl font-bold text-zinc-900 mb-2">{title}</h1>
            <p className="text-zinc-600 mb-8">{message}</p>

            <div className="space-y-4">
                <p className="text-sm text-zinc-500">
                    Entre em contato com o administrador do sistema para corrigir seu cadastro.
                </p>

                <form action={signOut}>
                    <Button variant="outline" className="w-full gap-2">
                        <LogOut className="w-4 h-4" />
                        Sair da conta
                    </Button>
                </form>
            </div>
        </div>
    );
}

export default function AuthErrorPage() {
    return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
            <Suspense fallback={<div>Carregando...</div>}>
                <AuthErrorContent />
            </Suspense>
        </div>
    );
}
