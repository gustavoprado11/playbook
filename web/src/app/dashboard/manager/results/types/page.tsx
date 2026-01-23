import { getProtocols } from '@/app/actions/results';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, ClipboardList, Plus } from 'lucide-react';
import { ProtocolForm } from './protocol-form';
import { ProtocolList } from './protocol-list';

export default async function ProtocolsPage() {
    const protocols = await getProtocols();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900">Configuração de Protocolos</h1>
                    <p className="mt-1 text-zinc-500">
                        Defina os protocolos e métricas de avaliação para os treinadores
                    </p>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5" />
                            Novo Protocolo
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ProtocolForm />
                    </CardContent>
                </Card>

                <ProtocolList protocols={protocols} />
            </div>
        </div>
    );
}
