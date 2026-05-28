import { getProfile } from '@/app/actions/auth';
import { getMyReferrals, getMyProfessionalContext } from '@/app/actions/referrals';
import { MessagesInbox } from './messages-inbox';

export default async function MessagesPage() {
    const [profile, inbox, sent, ctx] = await Promise.all([
        getProfile(),
        getMyReferrals('inbox'),
        getMyReferrals('sent'),
        getMyProfessionalContext(),
    ]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-zinc-900">Mensagens</h1>
                <p className="text-sm text-zinc-500">
                    Encaminhamentos e solicitações entre os profissionais que atendem os mesmos alunos.
                </p>
            </div>
            <MessagesInbox
                inbox={inbox}
                sent={sent}
                currentProfessionalId={ctx.professionalId}
                isManager={profile?.role === 'manager'}
            />
        </div>
    );
}
