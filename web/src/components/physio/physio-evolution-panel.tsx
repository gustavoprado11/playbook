'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Mic, MicOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { createPhysioEvolution, deletePhysioEvolution } from '@/app/actions/physio';
import type { PhysioEvolution } from '@/types/database';

interface Props {
    studentId: string;
    evolutions: PhysioEvolution[];
}

export function PhysioEvolutionPanel({ studentId, evolutions }: Props) {
    const router = useRouter();
    const [body, setBody] = useState('');
    const [saving, startSave] = useTransition();
    const [listening, setListening] = useState(false);
    const [supported, setSupported] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        setSupported(Boolean(SR));
        return () => {
            try { recognitionRef.current?.stop(); } catch { /* noop */ }
        };
    }, []);

    function toggleDictation() {
        if (listening) {
            try { recognitionRef.current?.stop(); } catch { /* noop */ }
            setListening(false);
            return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) return;
        const recognition = new SR();
        recognition.lang = 'pt-BR';
        recognition.continuous = true;
        recognition.interimResults = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
            let finalText = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
            }
            if (finalText) {
                setBody((prev) => (prev ? `${prev} ${finalText.trim()}` : finalText.trim()));
            }
        };
        recognition.onerror = () => setListening(false);
        recognition.onend = () => setListening(false);
        recognitionRef.current = recognition;
        recognition.start();
        setListening(true);
    }

    function save() {
        if (!body.trim()) return;
        // Garante que o ditado pare antes de salvar.
        try { recognitionRef.current?.stop(); } catch { /* noop */ }
        setListening(false);
        startSave(async () => {
            const r = await createPhysioEvolution(studentId, body);
            if (r.error) { toast.error(r.error); return; }
            toast.success('Evolução registrada');
            setBody('');
            router.refresh();
        });
    }

    function remove(id: string) {
        startSave(async () => {
            const r = await deletePhysioEvolution(id, studentId);
            if (r.error) { toast.error(r.error); return; }
            toast.success('Evolução excluída');
            router.refresh();
        });
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3">
                <div className="relative">
                    <Textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Descreva o que foi feito na sessão de hoje…"
                        className="min-h-[110px] pr-12"
                    />
                    {supported && (
                        <button
                            type="button"
                            onClick={toggleDictation}
                            title={listening ? 'Parar ditado' : 'Ditar por voz'}
                            className={`absolute right-2 top-2 rounded-full p-2 transition ${listening ? 'animate-pulse bg-red-100 text-red-600' : 'bg-zinc-100 text-zinc-500 hover:text-zinc-800'}`}
                        >
                            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        </button>
                    )}
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">
                        {supported
                            ? (listening ? 'Ouvindo… fale a evolução.' : 'Você pode ditar por voz pelo ícone do microfone.')
                            : 'Ditado por voz indisponível neste navegador.'}
                    </span>
                    <Button size="sm" onClick={save} disabled={!body.trim()} isLoading={saving}>
                        Salvar evolução
                    </Button>
                </div>
            </div>

            {evolutions.length === 0 ? (
                <p className="text-sm text-zinc-500">Nenhuma evolução registrada ainda.</p>
            ) : (
                <div className="space-y-2">
                    {evolutions.map((e) => (
                        <div key={e.id} className="group rounded-lg border border-zinc-200 bg-white p-3">
                            <div className="mb-1 flex items-center justify-between">
                                <span className="text-xs text-zinc-400">
                                    {new Date(e.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                                <button
                                    onClick={() => remove(e.id)}
                                    className="text-zinc-300 opacity-0 transition hover:text-red-600 group-hover:opacity-100"
                                    title="Excluir"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                            <p className="whitespace-pre-wrap text-sm text-zinc-700">{e.body}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
