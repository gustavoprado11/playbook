import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type {
    PerformanceReport,
    StudentMovementReport,
    ProfessionalActivityReport,
    StudentEvolutionReport,
} from '@/app/actions/reports';
import type { CrossDisciplineKPIs } from '@/app/actions/kpis';

const HEADER_COLOR = '#059669'; // emerald-600

function pdfHeader(doc: jsPDF, title: string, subtitle: string) {
    doc.setFontSize(18);
    doc.setTextColor(HEADER_COLOR);
    doc.text('Playbook', 14, 20);
    doc.setFontSize(14);
    doc.setTextColor('#18181b');
    doc.text(title, 14, 30);
    doc.setFontSize(10);
    doc.setTextColor('#71717a');
    doc.text(subtitle, 14, 37);
}

function pdfFooter(doc: jsPDF) {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor('#a1a1aa');
        doc.text(
            `Gerado em ${new Date().toLocaleString('pt-BR')} — Página ${i}/${pageCount}`,
            14,
            doc.internal.pageSize.height - 10
        );
    }
}

function formatPercent(v: number) {
    return `${(v * 100).toFixed(1)}%`;
}

function formatCurrency(v: number) {
    return `R$ ${v.toFixed(2).replace('.', ',')}`;
}

function formatDate(d: string) {
    if (!d) return '-';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
}

// =====================================================
// PERFORMANCE
// =====================================================

export function exportPerformancePDF(report: PerformanceReport) {
    const doc = new jsPDF('landscape');
    pdfHeader(doc, 'Performance Mensal', `Referência: ${report.referenceMonth}`);

    autoTable(doc, {
        startY: 44,
        head: [['Treinador', 'Alunos Início', 'Cancel.', 'Retenção', 'Meta', 'Indicações', 'Meta', 'Gestão', 'Meta', 'Recompensa']],
        body: report.rows.map(r => [
            r.trainerName,
            r.studentsStart,
            r.cancellations,
            formatPercent(r.retentionRate),
            formatPercent(r.retentionTarget),
            r.referralsCount,
            r.referralsTarget,
            formatPercent(r.managementRate),
            formatPercent(r.managementTarget),
            formatCurrency(r.rewardAmount),
        ]),
        foot: [['TOTAIS', '', '', formatPercent(report.totals.avgRetention), '', report.totals.totalReferrals, '', formatPercent(report.totals.avgManagement), '', formatCurrency(report.totals.totalRewards)]],
        headStyles: { fillColor: HEADER_COLOR },
        footStyles: { fillColor: '#f4f4f5', textColor: '#18181b', fontStyle: 'bold' },
        styles: { fontSize: 9 },
    });

    pdfFooter(doc);
    doc.save(`performance-${report.referenceMonth}.pdf`);
}

export async function exportPerformanceXLSX(report: PerformanceReport) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Performance');

    ws.addRow(['Playbook — Performance Mensal']);
    ws.addRow([`Referência: ${report.referenceMonth}`]);
    ws.addRow([]);

    const header = ws.addRow(['Treinador', 'Alunos Início', 'Alunos Fim', 'Cancel.', 'Retenção', 'Meta Ret.', 'Atingiu', 'Indicações', 'Meta Ind.', 'Atingiu', 'Gestão', 'Meta Gest.', 'Atingiu', 'Recompensa']);
    header.font = { bold: true };
    header.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '059669' } }; c.font = { bold: true, color: { argb: 'FFFFFF' } }; });

    report.rows.forEach(r => {
        ws.addRow([r.trainerName, r.studentsStart, r.studentsEnd, r.cancellations, r.retentionRate, r.retentionTarget, r.retentionAchieved ? 'Sim' : 'Não', r.referralsCount, r.referralsTarget, r.referralsAchieved ? 'Sim' : 'Não', r.managementRate, r.managementTarget, r.managementAchieved ? 'Sim' : 'Não', r.rewardAmount]);
    });

    ws.addRow([]);
    const totalsRow = ws.addRow(['TOTAIS', '', '', '', report.totals.avgRetention, '', '', report.totals.totalReferrals, '', '', report.totals.avgManagement, '', '', report.totals.totalRewards]);
    totalsRow.font = { bold: true };

    ws.columns.forEach(col => { col.width = 14; });
    if (ws.columns[0]) ws.columns[0].width = 22;

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `performance-${report.referenceMonth}.xlsx`);
}

// =====================================================
// STUDENT MOVEMENT
// =====================================================

const eventLabels: Record<string, string> = {
    new: 'Novo',
    cancelled: 'Cancelado',
    paused: 'Pausado',
    reactivated: 'Reativado',
    transferred: 'Transferido',
};

export function exportStudentMovementPDF(report: StudentMovementReport) {
    const doc = new jsPDF();
    pdfHeader(doc, 'Movimentação de Alunos', `Período: ${formatDate(report.period.start)} a ${formatDate(report.period.end)}`);

    doc.setFontSize(10);
    doc.setTextColor('#18181b');
    doc.text(`Novos: ${report.summary.newStudents} | Cancel.: ${report.summary.cancellations} | Pausas: ${report.summary.paused} | Reativações: ${report.summary.reactivated} | Saldo: ${report.summary.netChange >= 0 ? '+' : ''}${report.summary.netChange}`, 14, 44);

    autoTable(doc, {
        startY: 50,
        head: [['Aluno', 'Treinador', 'Tipo', 'Data', 'Detalhes']],
        body: report.rows.map(r => [r.studentName, r.trainerName, eventLabels[r.eventType] || r.eventType, formatDate(r.eventDate), r.details || '-']),
        headStyles: { fillColor: HEADER_COLOR },
        styles: { fontSize: 9 },
    });

    pdfFooter(doc);
    doc.save(`movimentacao-${report.period.start}-${report.period.end}.pdf`);
}

export async function exportStudentMovementXLSX(report: StudentMovementReport) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Movimentação');

    ws.addRow(['Playbook — Movimentação de Alunos']);
    ws.addRow([`Período: ${report.period.start} a ${report.period.end}`]);
    ws.addRow([`Novos: ${report.summary.newStudents} | Cancel.: ${report.summary.cancellations} | Pausas: ${report.summary.paused} | Reativações: ${report.summary.reactivated} | Saldo: ${report.summary.netChange}`]);
    ws.addRow([]);

    const header = ws.addRow(['Aluno', 'Treinador', 'Tipo', 'Data', 'Detalhes']);
    header.font = { bold: true };
    header.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '059669' } }; c.font = { bold: true, color: { argb: 'FFFFFF' } }; });

    report.rows.forEach(r => {
        ws.addRow([r.studentName, r.trainerName, eventLabels[r.eventType] || r.eventType, r.eventDate, r.details || '-']);
    });

    ws.columns.forEach(col => { col.width = 18; });

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `movimentacao-${report.period.start}-${report.period.end}.xlsx`);
}

// =====================================================
// PROFESSIONAL ACTIVITY
// =====================================================

const profTypeLabels: Record<string, string> = {
    nutritionist: 'Nutricionista',
    physiotherapist: 'Fisioterapeuta',
};

export function exportProfessionalActivityPDF(report: ProfessionalActivityReport) {
    const doc = new jsPDF();
    pdfHeader(doc, 'Atividade Profissional', `Referência: ${report.referenceMonth}`);

    autoTable(doc, {
        startY: 44,
        head: [['Profissional', 'Tipo', 'Pacientes', 'Atividades no Mês', 'Planos Ativos', 'Última Atividade']],
        body: report.rows.map(r => [r.professionalName, profTypeLabels[r.professionType], r.activePatients, r.activitiesThisMonth, r.activePlans, r.lastActivityDate ? formatDate(r.lastActivityDate) : '-']),
        headStyles: { fillColor: HEADER_COLOR },
        styles: { fontSize: 9 },
    });

    pdfFooter(doc);
    doc.save(`atividade-profissional-${report.referenceMonth}.pdf`);
}

export async function exportProfessionalActivityXLSX(report: ProfessionalActivityReport) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Atividade');

    ws.addRow(['Playbook — Atividade Profissional']);
    ws.addRow([`Referência: ${report.referenceMonth}`]);
    ws.addRow([]);

    const header = ws.addRow(['Profissional', 'Tipo', 'Pacientes Ativos', 'Atividades no Mês', 'Planos Ativos', 'Última Atividade']);
    header.font = { bold: true };
    header.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '059669' } }; c.font = { bold: true, color: { argb: 'FFFFFF' } }; });

    report.rows.forEach(r => {
        ws.addRow([r.professionalName, profTypeLabels[r.professionType], r.activePatients, r.activitiesThisMonth, r.activePlans, r.lastActivityDate || '-']);
    });

    ws.columns.forEach(col => { col.width = 18; });
    if (ws.columns[0]) ws.columns[0].width = 24;

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `atividade-profissional-${report.referenceMonth}.xlsx`);
}

// =====================================================
// STUDENT EVOLUTION
// =====================================================

const disciplineLabels: Record<string, string> = {
    training: 'Treino',
    nutrition: 'Nutrição',
    physiotherapy: 'Fisioterapia',
};

export function exportStudentEvolutionPDF(report: StudentEvolutionReport) {
    const doc = new jsPDF();
    pdfHeader(doc, `Evolução — ${report.studentName}`, `Período: ${formatDate(report.period.start)} a ${formatDate(report.period.end)} | Treinador: ${report.trainerName}`);

    if (report.linkedProfessionals.length > 0) {
        doc.setFontSize(9);
        doc.setTextColor('#71717a');
        doc.text(`Equipe: ${report.linkedProfessionals.map(p => `${p.name} (${profTypeLabels[p.type] || p.type})`).join(', ')}`, 14, 44);
    }

    autoTable(doc, {
        startY: report.linkedProfessionals.length > 0 ? 50 : 44,
        head: [['Data', 'Disciplina', 'Tipo', 'Descrição']],
        body: report.rows.map(r => [formatDate(r.date), disciplineLabels[r.discipline] || r.discipline, r.type, r.description]),
        headStyles: { fillColor: HEADER_COLOR },
        styles: { fontSize: 9 },
        columnStyles: { 3: { cellWidth: 80 } },
    });

    pdfFooter(doc);
    doc.save(`evolucao-${report.studentName.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

export async function exportStudentEvolutionXLSX(report: StudentEvolutionReport) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Evolução');

    ws.addRow([`Playbook — Evolução: ${report.studentName}`]);
    ws.addRow([`Treinador: ${report.trainerName} | Período: ${report.period.start} a ${report.period.end}`]);
    if (report.linkedProfessionals.length > 0) {
        ws.addRow([`Equipe: ${report.linkedProfessionals.map(p => `${p.name} (${profTypeLabels[p.type] || p.type})`).join(', ')}`]);
    }
    ws.addRow([]);

    const header = ws.addRow(['Data', 'Disciplina', 'Tipo', 'Descrição']);
    header.font = { bold: true };
    header.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '059669' } }; c.font = { bold: true, color: { argb: 'FFFFFF' } }; });

    report.rows.forEach(r => {
        ws.addRow([r.date, disciplineLabels[r.discipline] || r.discipline, r.type, r.description]);
    });

    ws.columns.forEach(col => { col.width = 18; });
    if (ws.columns[3]) ws.columns[3].width = 40;

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `evolucao-${report.studentName.replace(/\s+/g, '-').toLowerCase()}.xlsx`);
}

// =====================================================
// KPIs INTERDISCIPLINARES
// =====================================================

export function exportKPIsPDF(kpis: CrossDisciplineKPIs) {
    const doc = new jsPDF();
    pdfHeader(doc, 'KPIs Interdisciplinares', `Data: ${formatDate(kpis.referenceDate)}`);

    let y = 44;

    // Highlights
    if (kpis.highlights.length > 0) {
        doc.setFontSize(11);
        doc.setTextColor('#18181b');
        doc.text('Destaques', 14, y);
        y += 6;
        kpis.highlights.forEach(h => {
            doc.setFontSize(9);
            doc.setTextColor('#18181b');
            doc.text(`• ${h.title}`, 16, y);
            y += 4;
            doc.setTextColor('#71717a');
            doc.text(`  ${h.description}`, 18, y);
            y += 6;
        });
        y += 4;
    }

    // Coverage
    autoTable(doc, {
        startY: y,
        head: [['Segmento', 'Alunos', '%']],
        body: [
            ['Só Treino', kpis.coverage.trainingOnly, `${((kpis.coverage.trainingOnly / (kpis.coverage.totalActiveStudents || 1)) * 100).toFixed(0)}%`],
            ['+ Nutrição', kpis.coverage.withNutrition - kpis.coverage.withBoth, `${(((kpis.coverage.withNutrition - kpis.coverage.withBoth) / (kpis.coverage.totalActiveStudents || 1)) * 100).toFixed(0)}%`],
            ['+ Fisioterapia', kpis.coverage.withPhysio - kpis.coverage.withBoth, `${(((kpis.coverage.withPhysio - kpis.coverage.withBoth) / (kpis.coverage.totalActiveStudents || 1)) * 100).toFixed(0)}%`],
            ['Multidisciplinar', kpis.coverage.withBoth, `${((kpis.coverage.withBoth / (kpis.coverage.totalActiveStudents || 1)) * 100).toFixed(0)}%`],
        ],
        headStyles: { fillColor: HEADER_COLOR },
        styles: { fontSize: 9 },
    });

    // Retention
    const retY = (doc as any).lastAutoTable?.finalY + 10 || 120;
    autoTable(doc, {
        startY: retY,
        head: [['Segmento', 'Alunos', 'Cancel. 90d', 'Retenção', 'Tempo Médio']],
        body: kpis.retentionCorrelation.map(r => [r.segment, r.studentCount, r.cancellationsLast90Days, `${r.retentionRate.toFixed(1)}%`, `${r.avgMonthsActive} meses`]),
        headStyles: { fillColor: HEADER_COLOR },
        styles: { fontSize: 9 },
    });

    pdfFooter(doc);
    doc.save(`kpis-interdisciplinares-${kpis.referenceDate}.pdf`);
}

export async function exportKPIsXLSX(kpis: CrossDisciplineKPIs) {
    const wb = new ExcelJS.Workbook();

    // Coverage sheet
    const wsCov = wb.addWorksheet('Cobertura');
    wsCov.addRow(['Playbook — KPIs Interdisciplinares']);
    wsCov.addRow([`Data: ${kpis.referenceDate}`]);
    wsCov.addRow([]);
    const covHeader = wsCov.addRow(['Segmento', 'Alunos', '%']);
    covHeader.font = { bold: true };
    covHeader.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '059669' } }; c.font = { bold: true, color: { argb: 'FFFFFF' } }; });
    const total = kpis.coverage.totalActiveStudents || 1;
    wsCov.addRow(['Só Treino', kpis.coverage.trainingOnly, kpis.coverage.trainingOnly / total]);
    wsCov.addRow(['+ Nutrição', kpis.coverage.withNutrition - kpis.coverage.withBoth, (kpis.coverage.withNutrition - kpis.coverage.withBoth) / total]);
    wsCov.addRow(['+ Fisioterapia', kpis.coverage.withPhysio - kpis.coverage.withBoth, (kpis.coverage.withPhysio - kpis.coverage.withBoth) / total]);
    wsCov.addRow(['Multidisciplinar', kpis.coverage.withBoth, kpis.coverage.withBoth / total]);
    wsCov.columns.forEach(col => { col.width = 18; });

    // Engagement sheet
    const wsEng = wb.addWorksheet('Engajamento');
    const engHeader = wsEng.addRow(['Disciplina', 'Vinculados', 'Ativos Mês', 'Média/Aluno', 'Inativos 30d+', 'Engajamento %']);
    engHeader.font = { bold: true };
    engHeader.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '059669' } }; c.font = { bold: true, color: { argb: 'FFFFFF' } }; });
    kpis.engagement.forEach(e => {
        wsEng.addRow([e.discipline === 'nutrition' ? 'Nutrição' : 'Fisioterapia', e.totalLinked, e.activeThisMonth, e.avgActivitiesPerStudent, e.inactiveOver30Days, e.engagementRate]);
    });
    wsEng.columns.forEach(col => { col.width = 16; });

    // Retention sheet
    const wsRet = wb.addWorksheet('Retenção');
    const retHeader = wsRet.addRow(['Segmento', 'Alunos', 'Cancel. 90d', 'Retenção %', 'Tempo Médio (meses)']);
    retHeader.font = { bold: true };
    retHeader.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '059669' } }; c.font = { bold: true, color: { argb: 'FFFFFF' } }; });
    kpis.retentionCorrelation.forEach(r => {
        wsRet.addRow([r.segment, r.studentCount, r.cancellationsLast90Days, r.retentionRate, r.avgMonthsActive]);
    });
    wsRet.columns.forEach(col => { col.width = 18; });

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `kpis-interdisciplinares-${kpis.referenceDate}.xlsx`);
}
