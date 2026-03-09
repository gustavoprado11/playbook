import { getProtocols } from '@/app/actions/results';
import { getProfile } from '@/app/actions/auth';
import { redirect } from 'next/navigation';
import { ProtocolManagement } from '@/app/dashboard/manager/results/types/protocol-management';

export default async function TrainerProtocolsPage() {
    const profile = await getProfile();

    if (!profile || profile.role !== 'trainer') {
        redirect('/dashboard');
    }

    const protocols = await getProtocols();

    return (
        <ProtocolManagement
            title="Protocolos"
            description="Crie e edite os protocolos de avaliacao usados na sua operacao"
            protocols={protocols}
        />
    );
}
