import { redirect } from 'next/navigation';

// A prescrição por aluno agora vive no dashboard do aluno (Meus Alunos → aba "Prescrição de Treino").
// Mantido como redirect para links/back-buttons antigos.
export default async function LegacyStudentPrescriptionRedirect({
    params,
}: {
    params: Promise<{ studentId: string }>;
}) {
    const { studentId } = await params;
    redirect(`/dashboard/trainer/students/${studentId}?tab=prescription`);
}
