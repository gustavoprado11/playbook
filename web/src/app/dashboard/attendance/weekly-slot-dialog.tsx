'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { upsertWeeklyScheduleSlot } from '@/app/actions/attendance';
import { WEEKDAY_OPTIONS } from '@/lib/attendance';
import type { Profile, Student, Trainer, WeeklyScheduleTemplate } from '@/types/database';

interface WeeklySlotDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    role: 'manager' | 'trainer';
    slot?: WeeklyScheduleTemplate;
    students: (Student & { trainer: Trainer & { profile: Profile } })[];
    trainers: (Trainer & { profile: Profile })[];
    defaultTrainerId?: string;
}

export function WeeklySlotDialog({
    open,
    onOpenChange,
    role,
    slot,
    students,
    trainers,
    defaultTrainerId,
}: WeeklySlotDialogProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [participantMode, setParticipantMode] = useState<'student' | 'guest'>('student');
    const [studentId, setStudentId] = useState('');
    const [guestName, setGuestName] = useState('');
    const [guestOrigin, setGuestOrigin] = useState('');
    const [trainerId, setTrainerId] = useState('');
    const [weekday, setWeekday] = useState('1');
    const [startTime, setStartTime] = useState('06:00');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (!open) return;

        setParticipantMode(slot?.student_id ? 'student' : 'guest');
        setStudentId(slot?.student_id || students[0]?.id || '');
        setGuestName(slot?.guest_name || '');
        setGuestOrigin(slot?.guest_origin || '');
        setTrainerId(slot?.trainer_id || defaultTrainerId || trainers[0]?.id || '');
        setWeekday(slot ? String(slot.weekday) : '1');
        setStartTime(slot?.start_time?.slice(0, 5) || '06:00');
        setNotes(slot?.notes || '');
    }, [defaultTrainerId, open, slot, students, trainers]);

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();

        if (participantMode === 'student' && !studentId) {
            toast.error('Selecione um aluno');
            return;
        }

        if (participantMode === 'guest' && !guestName.trim()) {
            toast.error('Digite o nome da pessoa agendada');
            return;
        }

        if (role === 'manager' && !trainerId) {
            toast.error('Selecione o treinador responsavel');
            return;
        }

        startTransition(async () => {
            try {
                await upsertWeeklyScheduleSlot({
                    id: slot?.id,
                    student_id: participantMode === 'student' ? studentId : undefined,
                    guest_name: participantMode === 'guest' ? guestName : undefined,
                    guest_origin: participantMode === 'guest' ? guestOrigin : undefined,
                    trainer_id: role === 'manager' ? trainerId : undefined,
                    weekday: Number(weekday),
                    start_time: startTime,
                    notes,
                });

                toast.success(slot ? 'Horario base atualizado' : 'Horario base criado');
                onOpenChange(false);
                router.refresh();
            } catch (error) {
                console.error(error);
                toast.error(error instanceof Error ? error.message : 'Erro ao salvar horario base');
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg bg-white">
                <DialogHeader>
                    <DialogTitle>{slot ? 'Editar horario base' : 'Novo horario base'}</DialogTitle>
                    <DialogDescription>
                        Monte a agenda semanal com alunos cadastrados ou nomes avulsos para experimentais e visitas.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {role === 'manager' && (
                        <div className="space-y-2">
                            <Label>Treinador responsavel</Label>
                            <Select value={trainerId} onValueChange={setTrainerId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o treinador" />
                                </SelectTrigger>
                                <SelectContent>
                                    {trainers.map((trainer) => (
                                        <SelectItem key={trainer.id} value={trainer.id}>
                                            {trainer.profile?.full_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Tipo de agendamento</Label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setParticipantMode('student')}
                                className={participantMode === 'student'
                                    ? 'rounded-xl border border-emerald-500 bg-emerald-50 px-4 py-3 text-left text-sm font-medium text-emerald-700'
                                    : 'rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left text-sm font-medium text-zinc-600'}
                            >
                                Aluno cadastrado
                            </button>
                            <button
                                type="button"
                                onClick={() => setParticipantMode('guest')}
                                className={participantMode === 'guest'
                                    ? 'rounded-xl border border-emerald-500 bg-emerald-50 px-4 py-3 text-left text-sm font-medium text-emerald-700'
                                    : 'rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left text-sm font-medium text-zinc-600'}
                            >
                                Nome avulso
                            </button>
                        </div>
                    </div>

                    {participantMode === 'student' ? (
                        <div className="space-y-2">
                            <Label>Aluno</Label>
                            <Select value={studentId} onValueChange={setStudentId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o aluno" />
                                </SelectTrigger>
                                <SelectContent>
                                    {students.map((student) => (
                                        <SelectItem key={student.id} value={student.id}>
                                            {student.full_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            <Input
                                label="Nome"
                                value={guestName}
                                onChange={(event) => setGuestName(event.target.value)}
                                placeholder="Ex: Aula experimental - Carla"
                                required
                            />
                            <Input
                                label="Origem"
                                value={guestOrigin}
                                onChange={(event) => setGuestOrigin(event.target.value)}
                                placeholder="Ex: Experimental ou Unidade Centro"
                            />
                        </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Dia da semana</Label>
                            <Select value={weekday} onValueChange={setWeekday}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {WEEKDAY_OPTIONS.map((day) => (
                                        <SelectItem key={day.value} value={String(day.value)}>
                                            {day.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Input
                            type="time"
                            label="Horario"
                            value={startTime}
                            onChange={(event) => setStartTime(event.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Observacoes</Label>
                        <Textarea
                            value={notes}
                            onChange={(event) => setNotes(event.target.value)}
                            placeholder="Ex: chegada 10 minutos antes."
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" isLoading={isPending}>
                            {slot ? 'Salvar alteracoes' : 'Criar horario'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
