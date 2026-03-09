import { getProtocols } from '@/app/actions/results';
import { ProtocolManagement } from './protocol-management';

export default async function ProtocolsPage() {
    const protocols = await getProtocols();

    return (
        <ProtocolManagement
            title="Configuracao de Protocolos"
            description="Defina os protocolos e metricas de avaliacao para os treinadores"
            protocols={protocols}
        />
    );
}
