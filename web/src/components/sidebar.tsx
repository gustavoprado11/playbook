'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { signOut } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import {
    BarChart3,
    LayoutDashboard,
    Users,
    UserCheck,
    Settings,
    LogOut,
    Menu,
    X,
    Clock,
    TrendingUp,
    ClipboardList,
    FileText,
    Dumbbell,
    CircleDollarSign,
} from 'lucide-react';
import { useState } from 'react';

interface SidebarProps {
    role: 'manager' | 'trainer';
    userName: string;
}

interface NavItem {
    href?: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    disabled?: boolean;
}

export function Sidebar({ role, userName }: SidebarProps) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [tooltipItem, setTooltipItem] = useState<string | null>(null);

    // Active features
    const managerActiveLinks: NavItem[] = [
        { href: '/dashboard/manager', label: 'Visão Geral', icon: LayoutDashboard },
        { href: '/dashboard/manager/trainers', label: 'Treinadores', icon: UserCheck },
        { href: '/dashboard/manager/students', label: 'Alunos', icon: Users },
        { href: '/dashboard/manager/results/types', label: 'Gestão de Resultados', icon: TrendingUp },
        { href: '/dashboard/manager/rules', label: 'Política de Incentivos', icon: CircleDollarSign },
    ];

    const trainerActiveLinks: NavItem[] = [
        { href: '/dashboard/trainer', label: 'Meu Desempenho', icon: LayoutDashboard },
        { href: '/dashboard/trainer/students', label: 'Meus Alunos', icon: Users },
    ];

    // Evolution items (disabled)
    const evolutionItems: NavItem[] = [
        { label: 'Performance do Aluno', icon: ClipboardList, disabled: true },
        { label: 'Prescrição de Treino', icon: Dumbbell, disabled: true },
        { label: 'Relatórios', icon: FileText, disabled: true },
    ];

    const activeLinks = role === 'manager' ? managerActiveLinks : trainerActiveLinks;

    return (
        <>
            {/* Mobile menu button */}
            <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="fixed left-4 top-4 z-50 rounded-lg bg-white p-2 shadow-md lg:hidden"
            >
                {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>

            {/* Overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/20 lg:hidden"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-zinc-200 bg-white transition-transform lg:translate-x-0',
                    mobileOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <div className="flex h-16 items-center gap-3 border-b border-zinc-200 px-6">
                    <Image
                        src="/logo.png"
                        alt="Playbook"
                        width={32}
                        height={32}
                        className="object-contain"
                    />
                    <span className="text-lg font-semibold text-zinc-900">Playbook</span>
                </div>

                <nav className="flex-1 overflow-y-auto p-4">
                    {/* Active Features Section */}
                    <div className="space-y-1">
                        {activeLinks.map((link) => {
                            const Icon = link.icon;
                            const isActive = pathname === link.href;

                            return (
                                <Link
                                    key={link.href}
                                    href={link.href!}
                                    onClick={() => setMobileOpen(false)}
                                    className={cn(
                                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                        isActive
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                                    )}
                                >
                                    <Icon className="h-5 w-5" />
                                    {link.label}
                                </Link>
                            );
                        })}
                    </div>

                    {/* Divider with label */}
                    <div className="my-6 flex items-center gap-2">
                        <div className="h-px flex-1 bg-zinc-200" />
                        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                            Em evolução
                        </span>
                        <div className="h-px flex-1 bg-zinc-200" />
                    </div>

                    {/* Evolution Items Section */}
                    <div className="space-y-1">
                        {evolutionItems.map((item) => {
                            const Icon = item.icon;
                            const isHovered = tooltipItem === item.label;

                            return (
                                <div
                                    key={item.label}
                                    className="relative"
                                    onMouseEnter={() => setTooltipItem(item.label)}
                                    onMouseLeave={() => setTooltipItem(null)}
                                >
                                    <div
                                        className={cn(
                                            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                                            'text-zinc-400 cursor-default select-none'
                                        )}
                                    >
                                        <Icon className="h-5 w-5" />
                                        <span className="flex-1">{item.label}</span>
                                        <Clock className="h-4 w-4" />
                                    </div>

                                    {/* Tooltip */}
                                    {isHovered && (
                                        <div className="absolute left-full top-0 ml-2 z-50 w-64 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg animate-in fade-in slide-in-from-left-2 duration-200">
                                            <p className="text-sm font-medium text-zinc-900">
                                                Módulo em evolução
                                            </p>
                                            <p className="mt-1 text-xs text-zinc-500">
                                                Este recurso faz parte da evolução da plataforma Playbook e será disponibilizado em versões futuras.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </nav>

                <div className="border-t border-zinc-200 p-4">
                    <div className="mb-3 px-3">
                        <p className="text-sm font-medium text-zinc-900">{userName}</p>
                        <p className="text-xs text-zinc-500 capitalize">{role === 'manager' ? 'Gestor' : 'Treinador'}</p>
                    </div>
                    <form action={signOut}>
                        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-zinc-600">
                            <LogOut className="h-4 w-4" />
                            Sair
                        </Button>
                    </form>
                </div>
            </aside>
        </>
    );
}
