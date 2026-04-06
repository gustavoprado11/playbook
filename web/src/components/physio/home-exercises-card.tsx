'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dumbbell } from 'lucide-react';
import type { PhysioHomeExercise } from '@/types/database';

export function HomeExercisesCard({ exercises }: { exercises: PhysioHomeExercise[] }) {
    if (!exercises || exercises.length === 0) {
        return (
            <div className="text-center text-sm text-zinc-400 py-8">
                Nenhum exercício domiciliar registrado
            </div>
        );
    }

    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {exercises.map((ex, i) => (
                <Card key={i}>
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <Dumbbell className="h-4 w-4 text-emerald-600" />
                            <CardTitle className="text-sm">{ex.name}</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-1 text-sm text-zinc-600">
                            <p><span className="font-medium">Frequência:</span> {ex.frequency}</p>
                            <p><span className="font-medium">Duração:</span> {ex.duration}</p>
                            {ex.notes && <p className="text-zinc-500 mt-1">{ex.notes}</p>}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
