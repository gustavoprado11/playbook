'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera } from 'lucide-react';
import { generateAllSnapshots } from '@/app/actions/manager';
import { useRouter } from 'next/navigation';

export function GenerateSnapshotButton({ referenceMonth }: { referenceMonth: string }) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    async function handleGenerate() {
        setLoading(true);
        try {
            const result = await generateAllSnapshots(referenceMonth);
            if (result.error) {
                console.error(result.error);
            }
            router.refresh();
        } finally {
            setLoading(false);
        }
    }

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={loading}
        >
            <Camera className="h-4 w-4 mr-1.5" />
            {loading ? 'Gerando...' : 'Gerar snapshot'}
        </Button>
    );
}
