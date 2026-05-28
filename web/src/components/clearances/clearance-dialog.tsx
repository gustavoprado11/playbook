'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ShieldPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { createClearance } from '@/app/actions/clearances';
import type { ClearanceLevel } from '@/types/database';

export function ClearanceDialog({ studentId }: { studentId: string }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [level, setLevel] = useState<ClearanceLevel>('restricted');
    const [bodyRegion, setBodyRegion] = useState('');
    const [movements, setMovements] = useState('');
    const [description, setDescription] = useState('');
    const [reviewDate, setReviewDate] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit() {
        if (!description.trim()) return;
        setLoading(true);
        const result = await createClearance({
            studentId,
            level,
            description: description.trim(),
            bodyRegion: bodyRegion.trim() || undefined,
            affectedMovements: movements.trim()
                ? movements.split(',').map((m) => m.trim()).filter(Boolean)
                : undefined,
            reviewDate: reviewDate || undefined,
        });
        setLoading(false);
        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success('Liberação registrada');
            setOpen(false);
            setBodyRegion('');
            setMovements('');
            setDescription('');
            setReviewDate('');
            router.refresh();
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <ShieldPlus className="mr-2 h-4 w-4" />
                    Emitir liberação/restrição
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Liberação para o treino</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-zinc-700">Nível</label>
                        <Select value={level} onValueChange={(v) => setLevel(v as ClearanceLevel)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cleared">Liberado</SelectItem>
                                <SelectItem value="cleared_with_notes">Liberado com ressalvas</SelectItem>
                                <SelectItem value="restricted">Restrito</SelectItem>
                                <SelectItem value="contraindicated">Contraindicado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-zinc-700">Região do corpo</label>
                        <Input value={bodyRegion} onChange={(e) => setBodyRegion(e.target.value)} placeholder="Ex.: joelho direito" />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-zinc-700">Movimentos afetados</label>
                        <Input value={movements} onChange={(e) => setMovements(e.target.value)} placeholder="Separe por vírgula: agachamento profundo, impacto" />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-zinc-700">Orientação ao treinador</label>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o que evitar / como adaptar" />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-zinc-700">Reavaliar em (opcional)</label>
                        <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={!description.trim()} isLoading={loading}>Registrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
