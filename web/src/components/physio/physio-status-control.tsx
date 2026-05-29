'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { setPhysioPatientStatus } from '@/app/actions/physio';
import type { PhysioCareStatus } from '@/types/database';

interface Props {
    studentId: string;
    careStatus?: PhysioCareStatus;
    dischargedAt?: string | null;
    size?: 'sm' | 'default';
}

export function PhysioStatusControl({ studentId, careStatus = 'in_treatment', dischargedAt, size = 'sm' }: Props) {
    const router = useRouter();
    const [pending, start] = useTransition();
    const discharged = careStatus === 'discharged';

    function change(status: 'in_treatment' | 'discharged') {
        start(async () => {
            const r = await setPhysioPatientStatus(studentId, status);
            if (r.error) { toast.error(r.error); return; }
            toast.success(status === 'discharged' ? 'Alta registrada' : 'Paciente reativado');
            router.refresh();
        });
    }

    return (
        <div className="flex items-center gap-2">
            <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${discharged ? 'bg-zinc-100 text-zinc-600' : 'bg-emerald-100 text-emerald-700'}`}
            >
                {discharged
                    ? `Alta${dischargedAt ? ` · ${new Date(dischargedAt).toLocaleDateString('pt-BR')}` : ''}`
                    : 'Em atendimento'}
            </span>
            {discharged ? (
                <Button variant="outline" size={size} disabled={pending} onClick={() => change('in_treatment')}>
                    Reativar
                </Button>
            ) : (
                <Button variant="outline" size={size} disabled={pending} onClick={() => change('discharged')}>
                    Dar alta
                </Button>
            )}
        </div>
    );
}
