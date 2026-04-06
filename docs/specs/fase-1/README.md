# Specs — Fase 1: Fundação Multidisciplinar

Este diretório contém as especificações técnicas detalhadas para a Fase 1 do ecossistema integrado de saúde do Playbook.

## Documentos

| # | Arquivo | Escopo | Sprint |
|---|---------|--------|--------|
| 1 | `01-infraestrutura.md` | Novas tabelas base, enum, RLS, middleware, routing | Sprint 1 |
| 2 | `02-modulo-nutricao.md` | Prontuário nutricional completo (consultas, anamnese, métricas, planos, exames) | Sprint 2 |
| 3 | `03-modulo-fisioterapia.md` | Prontuário fisioterapêutico completo (sessões, anamnese, métricas, protocolos, evolução) | Sprint 3 |
| 4 | `04-manager-integracao.md` | Painel de profissionais no manager, gestão de vínculos, indicadores | Sprint 4 |
| 5 | `05-spec-testes.md` | Suite de testes de integração + bugs corrigidos + instruções para Claude Code | Pós-sprint |

## Como usar com Claude Code

Cada spec foi escrita para ser delegada diretamente ao Claude Code. O fluxo recomendado:

```bash
# Abrir o projeto no terminal
cd /path/to/Playbook

# Delegar sprint por sprint
claude "Leia o arquivo docs/specs/fase-1/01-infraestrutura.md e implemente todas as tarefas descritas. Siga exatamente os padrões de código, nomes de arquivo e convenções documentadas."
```

## Ordem de execução

As specs devem ser executadas **em ordem** (01 → 02 → 03 → 04), pois cada uma depende da anterior.

## Referência

- PRD completo: `docs/PRD-ecossistema-saude.md`
- Migrations existentes: `supabase/migrations/001-018`
- Próxima migration disponível: `019`
