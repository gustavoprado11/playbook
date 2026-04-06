'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { linkStudentToProfessional } from '@/app/actions/professionals';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import type { ProfessionType, Profile } from '@/types/database';

interface ProfessionalOption {
    id: string;
    profession_type: ProfessionType;
    profile: Profile;
    is_active: boolean;
}

interface Props {
    studentId: string;
    professionals: ProfessionalOption[];
}

export function LinkProfessionalDialog({ studentId, professionals }: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [selectedType, setSelectedType] = useState<string>('');
    const [selectedProfessional, setSelectedProfessional] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    const filteredProfessionals = professionals.filter(
        p => p.is_active && (!selectedType || p.profession_type === selectedType)
    );

    useEffect(() => {
        setSelectedProfessional('');
    }, [selectedType]);

    async function handleLink() {
        if (!selectedProfessional) return;
        setIsLoading(true);

        const result = await linkStudentToProfessional(studentId, selectedProfessional);

        setIsLoading(false);
        if (result.error) {
            toast.error(result.error);
        } else {
            toast.success('Profissional vinculado com sucesso');
            setOpen(false);
            setSelectedType('');
            setSelectedProfessional('');
            router.refresh();
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Vincular Profissional
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Vincular Profissional</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                            Tipo de profissional
                        </label>
                        <Select value={selectedType} onValueChange={setSelectedType}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="nutritionist">Nutricionista</SelectItem>
                                <SelectItem value="physiotherapist">Fisioterapeuta</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedType && (
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                                Profissional
                            </label>
                            <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o profissional" />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredProfessionals.length === 0 ? (
                                        <SelectItem value="_none" disabled>
                                            Nenhum profissional disponível
                                        </SelectItem>
                                    ) : (
                                        filteredProfessionals.map((p) => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.profile?.full_name}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button onClick={handleLink} disabled={!selectedProfessional} isLoading={isLoading}>
                        Vincular
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
