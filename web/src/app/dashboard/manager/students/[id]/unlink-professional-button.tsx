'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { unlinkStudentFromProfessional } from '@/app/actions/professionals';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

export function UnlinkProfessionalButton({ studentId, professionalId }: { studentId: string; professionalId: string }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    async function handleUnlink() {
        setLoading(true);
        const result = await unlinkStudentFromProfessional(studentId, professionalId);
        setLoading(false);

        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success('Vínculo removido');
            router.refresh();
        }
    }

    return (
        <Button
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:text-red-600"
            onClick={handleUnlink}
            disabled={loading}
        >
            <X className="h-4 w-4" />
        </Button>
    );
}
