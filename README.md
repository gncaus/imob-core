# Imob Core

Fatia vertical do sistema próprio de uma imobiliária que hoje usa o Imoview. O teste resolve as duas dores principais do cliente:

1. **Leads misturados:** cada lead que chega pelos portais do Grupo OLX (ZAP, Viva Real, OLX) é roteado automaticamente para a fila certa: **Locação**, **Vendas** ou **Triagem**. Dentro da fila, uma roleta escolhe o corretor.
2. **Site engessado:** o cadastro de imóveis no painel gera um feed **VRSync** válido para os portais. O XML gerado foi aprovado no validador oficial do Grupo OLX.

## Como rodar

### Opção 1: só com Docker (para ver funcionando)

Pré-requisito: Docker. Um único comando sobe banco, Redis, storage, API e painel. Na primeira subida, as migrações são aplicadas e o banco é populado sozinho.

```bash
docker compose --profile app up -d --build    # a primeira vez leva alguns minutos (build das imagens)
docker compose exec api pnpm -w simulate:leads   # envia os leads de exemplo ao webhook
```

Depois abra http://localhost:3000. Para desligar, use `docker compose --profile app down`; com `-v`, os dados também são apagados.

### Opção 2: desenvolvimento local

Pré-requisitos: Node.js 22.12+, pnpm 10 (`corepack enable`) e Docker.

```bash
pnpm install
cp .env.example .env          # os valores padrão já funcionam localmente
docker compose up -d          # só a infraestrutura: postgres, redis, minio
pnpm db:migrate && pnpm db:seed
pnpm dev                      # api em :3333, painel em :3000
pnpm test
pnpm simulate:leads           # com o pnpm dev rodando
```

> Se a porta 5432 já estiver em uso por um Postgres local, defina `POSTGRES_PORT=5433` no `.env` e ajuste a porta no `DATABASE_URL`. As duas opções usam as mesmas portas: rode uma de cada vez.

| O quê               | Onde                                   | Acesso                                                                                 |
| ------------------- | -------------------------------------- | -------------------------------------------------------------------------------------- |
| Painel              | http://localhost:3000                  | `admin@imob.local` / `admin12345`                                                      |
| Corretores (painel) | http://localhost:3000                  | `ana@`, `bruno@` (Locação), `carla@`, `diego@` (Vendas) `imob.local` / `corretor12345` |
| API                 | http://localhost:3333                  | `GET /health`                                                                          |
| Feed VRSync         | http://localhost:3333/feeds/vrsync.xml | público                                                                                |
| Console do MinIO    | http://localhost:9001                  | `imob` / `imob-secret`                                                                 |

O seed cria 1 admin, 4 corretores (2 por fila) e 8 imóveis em Vila Velha e Vitória: 3 de venda, 3 de locação, 1 de venda e locação e 1 incompleto. As fotos são geradas localmente pelo próprio seed, então não há imagens com direitos autorais. O seed pode ser rodado de novo sem duplicar nada.

## Roteiro de demonstração (5 minutos)

**1. O problema (30 s).** Hoje os leads de aluguel caem no WhatsApp de venda e vice-versa, e o site depende do fornecedor. A demonstração mostra o caminho completo: imóvel cadastrado → feed nos portais → lead do portal → fila e corretor certos.

**2. Imóveis e pendências (1 min).** Entre no painel como admin e abra **Imóveis**:

- Sete imóveis aparecem como "Pronto para portais".
- O **VV-104 (Casa em Itaparica)** aparece com pendências. Abra o imóvel: o painel lista o que falta para os portais, como descrição de 50 a 3.000 caracteres, valor do aluguel, área útil, banheiros e pelo menos 5 fotos.
- Mostre no formulário o CEP, que preenche o endereço via ViaCEP, e as fotos, que podem ser reordenadas e ter uma marcada como principal.

**3. Feed para os portais (1 min).** Abra **Feed dos portais**:

- A URL do feed aparece pronta para cadastrar no Grupo OLX, com **7 imóveis no feed** e **1 de fora** junto com o motivo.
- Abra o XML: ele traz `ListingDataFeed` no namespace VRSync, `TransactionType` por finalidade, preços em reais inteiros, CDATA nos textos com acento e exatamente uma foto `primary`.
- Diga que este XML passou no validador oficial.

**4. Leads chegando (1 min 30 s).** No terminal, rode `pnpm simulate:leads` (ou `docker compose exec api pnpm -w simulate:leads`, na opção só com Docker) e deixe a aba **Leads** aberta. O simulador envia ao webhook os cenários do enunciado e mostra o status HTTP e a fila de cada um:

| Cenário                                         | HTTP | Resultado                       |
| ----------------------------------------------- | ---- | ------------------------------- |
| Aluguel (`transactionType=RENT`)                | 201  | Locação, com corretor da roleta |
| Compra (`transactionType=SELL`)                 | 201  | Vendas, com corretor da roleta  |
| Imóvel de venda e locação sem `transactionType` | 201  | Triagem: nunca chuta            |
| MCMV (sem anúncio)                              | 201  | Vendas                          |
| Reenvio do mesmo `originLeadId`                 | 200  | Não duplica                     |
| Lead de anúncio sem `clientListingId`           | 400  | Recusado, como o portal exige   |

No painel, que atualiza sozinho, mostre os cards:

- Cada card traz a origem, o canal (WhatsApp, formulário, chat), o imóvel, o corretor e **o motivo do roteamento**.
- O botão de WhatsApp abre a conversa com o cliente.
- Na Triagem, use "Mover para…" Vendas: o lead ganha corretor pela roleta e o motivo registra quem moveu.

**5. Corretores e roleta (30 s).** Em **Corretores**, desative um corretor e rode o simulador de novo: ele sai da roleta. Se nenhum corretor estiver ativo, o lead fica na fila sem dono, à espera.

**6. Fechamento (30 s).** Mostre a qualidade do código:

- `pnpm test` roda cerca de 250 testes, incluindo as regras do feed, o webhook e o roteamento.
- A arquitetura está preparada para OpenNavent, Chaves na Mão e a API do WhatsApp sem mexer no que já existe.

## Arquitetura

```
apps/
  api/            NestJS 11 · Prisma 7 (PostgreSQL 16) · BullMQ (Redis) · S3 (MinIO)
    src/modules/
      auth/         login com JWT em cookie httpOnly, guard global com papéis
      agents/       corretores e roleta (roulette.ts)
      properties/   imóveis, fotos e portal-readiness.ts
      portals/      PortalFeedGenerator + gerador VRSync
      leads/        webhook do Grupo OLX, routing.ts, job de roteamento, LeadNotifier
    src/common/     config (Zod), erros de domínio, Prisma, storage, filas, logs (pino)
  web/            Next.js 16 (App Router) · shadcn/ui · TanStack Query · React Hook Form
packages/
  shared/         schemas Zod, enums e tipos usados pela API e pelo painel
scripts/
  simulate-lead.ts
```

Cada módulo segue `controller` (HTTP fino) → `service` (regra de negócio) → Prisma. As regras críticas são funções puras e testadas:

- **[`portal-readiness.ts`](apps/api/src/modules/properties/portal-readiness.ts):** as pendências para os portais, usadas pelo feed e pelo painel.
- **[`vrsync-feed.generator.ts`](apps/api/src/modules/portals/vrsync/vrsync-feed.generator.ts):** o XML do feed, com teste de snapshot em [`vrsync-feed.xml`](apps/api/src/modules/portals/vrsync/__snapshots__/vrsync-feed.xml).
- **[`grupo-olx-payload.ts`](apps/api/src/modules/leads/grupo-olx/grupo-olx-payload.ts):** a leitura tolerante do payload do webhook.
- **[`routing.ts`](apps/api/src/modules/leads/routing.ts):** a escolha da fila e o motivo.
- **[`roulette.ts`](apps/api/src/modules/agents/roulette.ts):** a escolha do corretor.

O fluxo de um lead:

1. O webhook valida a chave e o payload, grava o lead com o payload bruto e responde **2xx só depois de gravar**.
2. O webhook enfileira um job no BullMQ, com o id do lead como id do job.
3. O job decide a fila e atribui o corretor dentro de uma transação. Um lock na linha do lead e um lock por fila evitam roteamento duplo e evitam que dois leads simultâneos caiam no mesmo corretor.
4. O job avisa o corretor pelo `LeadNotifier`. Hoje é o `LogNotifier`, que registra o link `wa.me`.

## Decisões e pontos de atenção

As regras seguem a documentação oficial do Grupo OLX. Onde ela diverge do enunciado, a documentação venceu:

- **Autenticação do webhook:** é feita por Basic Auth, com a chave secreta no lugar da senha (`GRUPO_OLX_WEBHOOK_SECRET`), como manda a [página de segurança](https://developers.grupozap.com/webhooks/security.html). Chave ausente ou errada responde 401.
- **MCMV:** é identificado por `leadOrigin = "MCMV_OLX"`, e não pelo `leadType`.
- **Feed:**
  - A descrição é obrigatória, com 50 a 3.000 caracteres.
  - `PropertyType` usa a lista oficial de 24 tipos.
  - As áreas são inteiras: `LotArea` para terrenos, galpões e fazendas, `LivingArea` para os demais tipos.
  - Quartos e banheiros são obrigatórios conforme o tipo.
  - O IPTU vai no elemento `Iptu`, porque `YearlyTax` está em desuso.
- **URL imutável das fotos:** a chave no storage inclui o hash do conteúdo. Trocar a imagem gera uma URL nova, que é como o portal identifica a mudança.
- **Webhook tolerante:** a API só recusa o que a documentação manda recusar. Uma temperatura ou um `transactionType` inesperados viram `null`, porque um 4xx faria o portal desistir do lead depois das tentativas.

Decisões próprias, onde o enunciado não definia:

- **Conflito portal × imóvel:** se o portal diz RENT e o imóvel é só de venda, ou o contrário, o lead vai para a **Triagem** ("nunca chutar").
- **Exclusão de corretor:** um corretor com leads não pode ser excluído, para não perder o histórico. Ele deve ser desativado.
- **Endereço do anúncio:** quando o anúncio exibe a rua, ou rua e número, esses campos passam a ser pendência. A documentação só exige o bairro.
- **Preço de venda:** é guardado em `BigInt` de centavos, porque `Int` não comporta valores acima de R$ 21 milhões.
- **Fila de roteamento:** se o Redis estiver fora, o enfileiramento desiste em 5 s e o webhook responde 5xx. O portal reenvia e o lead, que já está gravado, é enfileirado de novo. Ao subir, a API também reenfileira os leads pendentes.
- **Log do `LogNotifier`:** ele registra o link `wa.me`, com o telefone do cliente, como pede o enunciado. Isso deixa de ir para o log quando a API real do WhatsApp substituir o `LogNotifier`.
- **MinIO:** o repositório oficial `minio/minio` saiu do Docker Hub, então o compose usa o fork mantido pela comunidade (`pgsty/minio`).

## Testes

```bash
pnpm test        # shared + api (unidade e e2e) + painel
pnpm lint
pnpm typecheck
```

Os testes e2e usam um banco separado (`imob_test`), um bucket separado e um prefixo próprio no Redis. O próprio `pnpm test` cria e migra esse banco, mas os containers do `docker compose` precisam estar no ar.

## Fora do escopo (próximos passos)

Os itens abaixo ficaram de fora deste teste. A arquitetura já tem os pontos de extensão para eles:

- sites públicos e CMS;
- contratos de locação, cobrança, repasse e comissões;
- **feeds OpenNavent e Chaves na Mão:** são novas implementações de `PortalFeedGenerator`;
- **API oficial do WhatsApp:** é uma nova implementação de `LeadNotifier`;
- migração dos dados do Imoview.
