import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  Target,
  TrendingUp,
  Shield,
  Clock,
  BarChart3,
  Users,
  Coins,
  ChevronRight
} from 'lucide-react';
import Image from 'next/image';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-zinc-50 to-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-100/40 via-transparent to-transparent" />

        <div className="relative mx-auto max-w-5xl px-6 py-24 sm:py-32 text-center">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center">
            <Image
              src="/logo.png"
              alt="Playbook Logo"
              width={80}
              height={80}
              className="object-contain"
              priority
            />
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl">
            Playbook
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-xl text-zinc-600">
            A plataforma de gestão de performance do seu estúdio.
            <br className="hidden sm:block" />
            Transforme resultados em decisões claras e remuneração justa.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login">
              <Button size="lg" className="gap-2 text-base px-8">
                Acessar o Sistema
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* What Playbook Does Today */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-zinc-900">
              O que o Playbook faz hoje
            </h2>
            <p className="mt-4 text-lg text-zinc-500 max-w-2xl mx-auto">
              Uma base sólida para gestão de performance e remuneração variável da sua equipe.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 transition-shadow hover:shadow-lg">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 mb-6">
                <Target className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900">
                Indicadores de Performance
              </h3>
              <p className="mt-3 text-zinc-500">
                Acompanhe retenção, indicações e gestão de resultados com metas claras e mensuráveis.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 transition-shadow hover:shadow-lg">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 mb-6">
                <Coins className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900">
                Política de Incentivos
              </h3>
              <p className="mt-3 text-zinc-500">
                Configure critérios de elegibilidade e valores de recompensa que fazem sentido para o seu negócio.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 transition-shadow hover:shadow-lg">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 mb-6">
                <Shield className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900">
                Transparência Total
              </h3>
              <p className="mt-3 text-zinc-500">
                Treinadores acompanham seu próprio desempenho em tempo real, sem surpresas no fechamento.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 transition-shadow hover:shadow-lg">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 mb-6">
                <Clock className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900">
                Histórico Auditável
              </h3>
              <p className="mt-3 text-zinc-500">
                Snapshots mensais imutáveis garantem que decisões passadas nunca são alteradas retroativamente.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 transition-shadow hover:shadow-lg">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 mb-6">
                <Users className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900">
                Gestão de Equipe
              </h3>
              <p className="mt-3 text-zinc-500">
                Visão consolidada de treinadores, alunos e performance geral do estúdio em um só lugar.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 transition-shadow hover:shadow-lg">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 mb-6">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900">
                Políticas Versionadas
              </h3>
              <p className="mt-3 text-zinc-500">
                Evolua seus critérios ao longo do tempo sem comprometer a integridade dos períodos anteriores.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Evolution */}
      <section className="py-20 px-6 bg-zinc-50">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-zinc-900">
              Evolução da Plataforma
            </h2>
            <p className="mt-4 text-lg text-zinc-500 max-w-2xl mx-auto">
              O Playbook foi construído para crescer junto com o seu estúdio.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex gap-4 items-start rounded-xl border border-zinc-200 bg-white p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                <ChevronRight className="h-5 w-5 text-zinc-600" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900">Aprofundamento de Gestão</h3>
                <p className="mt-1 text-zinc-500">
                  Mais indicadores, dashboards avançados e visões segmentadas para decisões cada vez mais precisas.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start rounded-xl border border-zinc-200 bg-white p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                <ChevronRight className="h-5 w-5 text-zinc-600" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900">Integração de Dados</h3>
                <p className="mt-1 text-zinc-500">
                  Conexão com sistemas de gestão de alunos e ferramentas que você já utiliza no dia a dia.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start rounded-xl border border-zinc-200 bg-white p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                <ChevronRight className="h-5 w-5 text-zinc-600" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900">Centralização da Operação</h3>
                <p className="mt-1 text-zinc-500">
                  O Playbook como núcleo de inteligência do estúdio, conectando performance, receita e crescimento.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
            Pronto para organizar a performance do seu estúdio?
          </h2>
          <p className="mt-4 text-lg text-zinc-500">
            Acesse o Playbook e comece a construir uma cultura de resultados.
          </p>
          <div className="mt-8">
            <Link href="/login">
              <Button size="lg" className="gap-2 text-base px-8">
                Acessar o Sistema
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-8 px-6">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Playbook Logo"
              width={24}
              height={24}
              className="object-contain"
            />
            <span className="font-semibold text-zinc-900">Playbook</span>
          </div>
          <p className="text-sm text-zinc-500">
            Performance clara. Remuneração justa.
          </p>
        </div>
      </footer>
    </div>
  );
}
