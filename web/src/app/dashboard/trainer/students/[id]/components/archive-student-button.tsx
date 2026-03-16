'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Archive } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { trainerArchiveStudent } from '@/app/actions/manager';

interface ArchiveStudentButtonProps {
    studentId: string;
    studentName: string;
}

export function ArchiveStudentButton({ studentId, studentName }: ArchiveStudentButtonProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    function handleArchive() {
        startTransition(async () => {
            try {
                await trainerArchiveStudent(studentId);
                toast.success(`${studentName} foi arquivado`);
                router.push('/dashboard/trainer/students');
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Erro ao arquivar aluno');
            }
        });
    }

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(true)}
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            >
                <Archive className="mr-2 h-4 w-4" />
                Arquivar aluno
            </Button>

            <AlertDialog open={open} onOpenChange={setOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Arquivar aluno</AlertDialogTitle>
                        <AlertDialogDescription>
                            O aluno será removido da sua lista e de todos os horários da agenda.
                            Esta ação pode ser desfeita pelo gestor.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleArchive}
                            disabled={isPending}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {isPending ? 'Arquivando...' : 'Arquivar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
