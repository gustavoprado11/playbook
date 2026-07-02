import { redirect } from 'next/navigation';

// Lista de alunos para prescrição foi unificada em "Meus Alunos".
export default function LegacyPrescriptionStudentsRedirect() {
    redirect('/dashboard/trainer/students');
}
