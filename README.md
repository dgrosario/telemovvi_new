# Omnichannel

Plataforma omnichannel para atendimento e automação de conversas, com interface web em Next.js, camada compartilhada de domínio em TypeScript e infraestrutura local baseada em Docker Compose.

## Requisitos

- Node.js 22 ou superior
- pnpm 10
- Docker e Docker Compose

## Estrutura

- `apps/web`: aplicação web em Next.js 16, React 19, MUI 7, TanStack Query, React Flow e Vitest.
- `apps/omni-gateway`: serviço de gateway em NestJS 10, com RabbitMQ, Redis, PostgreSQL (`postgres`), Mongoose e Jest.
- `packages/core`: camada compartilhada de domínio e aplicação em TypeScript, com Drizzle ORM, PostgreSQL e Vitest.
- `packages/typescript-config`: presets de TypeScript compartilhados no monorepo.
- `packages/eslint-config`: presets de lint compartilhados no monorepo.

## Configuração do ambiente

Crie os arquivos locais a partir dos exemplos já versionados:

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env
cp apps/omni-gateway/.env.example apps/omni-gateway/.env
cp packages/core/.env.example packages/core/.env
```

Os arquivos de exemplo cobrem:

- `.env.example`: portas, nomes de containers e variáveis da infraestrutura local.
- `apps/web/.env.example`: conexão do frontend com banco, RabbitMQ e gateway.
- `apps/omni-gateway/.env.example`: variáveis do serviço de gateway e integrações externas.
- `packages/core/.env.example`: banco, seed inicial e integrações opcionais.

## Instalação

```bash
pnpm install
```

## Subir infraestrutura local

```bash
pnpm run docker:build
pnpm run docker:up
```

Serviços principais:

- PostgreSQL
- RabbitMQ
- Redis
- Evolution API
- aplicação web

Para acompanhar logs:

```bash
pnpm run docker:logs
pnpm run docker:logs:web
pnpm run docker:logs:gateway
```

Para encerrar:

```bash
pnpm run docker:down
```

## Banco de dados

Com os containers ativos, execute:

```bash
pnpm run db:migrate
pnpm run db:seed
```

Outros comandos disponíveis:

```bash
pnpm run db:generate
pnpm run db:drop
pnpm run db:seed:dev
```

## Desenvolvimento

Executar todo o monorepo:

```bash
pnpm run dev
```

Executar apenas a aplicação web:

```bash
pnpm run dev:web
```

Executar apenas o gateway:

```bash
pnpm run dev:gateway
```

Build e validações:

```bash
pnpm run build
pnpm run check-types
pnpm run lint
pnpm run format
```

## Execução da aplicação web

```bash
pnpm run start
pnpm run start:web
```

## Licença

O arquivo de licença do projeto está na raiz em `LICENSE`.
