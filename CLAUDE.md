# CLAUDE.md — Imob Core (teste técnico M9 Soluções)

## Contexto

Este repositório é o entregável do teste técnico para a M9 Soluções. O cliente final é uma imobiliária que usa o **Imoview** e quer um sistema próprio. As duas dores principais são:

1. **Leads misturados:** leads de aluguel chegam no WhatsApp de venda e vice-versa.
2. **Site engessado:** qualquer alteração visual precisa ser pedida por e-mail ao fornecedor.

O teste é uma **fatia vertical** do produto final que prova o núcleo técnico:

> Um imóvel cadastrado no painel gera um feed XML VRSync válido para os portais do Grupo OLX (ZAP, Viva Real, OLX), e um lead enviado pelo portal chega ao sistema e é roteado automaticamente para a fila correta: **Locação** ou **Vendas**.

O código deve ter qualidade de produção, porque é a base do sistema real se o contrato fechar.

## Escopo do teste

### Dentro
- Cadastro de imóveis (CRUD) com finalidade, preços, endereço, características e fotos
- Validação de "pronto para portais" (regras VRSync abaixo), com lista de pendências por imóvel
- Feed público `GET /feeds/vrsync.xml` com os imóveis publicáveis
- Webhook `POST /webhooks/leads/grupo-olx` no formato oficial do Grupo OLX
- Roteamento de leads por finalidade + roleta simples de corretores por fila
- Painel web com: login, imóveis (lista, formulário, pendências), leads por fila, corretores
- Script que simula o envio de leads do portal (para a demo)
- Docker Compose com tudo subindo com um comando
- Testes automatizados das regras críticas (feed, webhook, roteamento)

### Fora (não implementar agora)
Sites públicos, CMS, contratos de locação, cobrança, repasse, vendas/comissões, WhatsApp API real, feeds OpenNavent/Chaves na Mão, migração do Imoview. Deixar a arquitetura preparada para eles, sem código especulativo.

## Stack

- **Monorepo:** pnpm workspaces + Turborepo
- **API:** Node.js 22 LTS, NestJS 11, TypeScript strict
- **Banco:** PostgreSQL 16 + Prisma (schema e migrações)
- **Filas:** Redis + BullMQ (processamento de leads e geração do feed)
- **Arquivos:** MinIO local (compatível com S3) para fotos
- **Painel:** Next.js (App Router) + Tailwind + shadcn/ui + TanStack Query + React Hook Form + Zod
- **Validação compartilhada:** Zod em `packages/shared`, usado no painel e na API
- **Testes:** Vitest (unidade) + Supertest (e2e da API)
- **Qualidade:** ESLint + Prettier, commits no padrão Conventional Commits

## Estrutura

```
apps/
  api/            # NestJS
    src/
      modules/
        auth/
        properties/     # imóveis, fotos, validação para portais
        portals/        # feeds (vrsync agora; opennavent e chavesnamao depois)
        leads/          # webhook, deduplicação, roteamento, filas
        agents/         # corretores e roleta
      common/           # guards, filtros, interceptors, config
    prisma/
  web/            # painel Next.js
packages/
  shared/         # schemas Zod, enums, tipos
scripts/
  simulate-lead.ts  # envia leads de exemplo ao webhook
docker-compose.yml
```

Cada módulo do Nest segue: `controller` (HTTP fino) → `service` (regra de negócio) → Prisma. Geradores de feed ficam atrás de uma interface `PortalFeedGenerator` para adicionar novos portais sem mexer nos existentes.

## Modelo de dados (mínimo)

- **User**: id, nome, email, senhaHash, papel (`ADMIN` | `AGENT`)
- **Agent** (corretor): id, userId, fila (`RENTAL` | `SALES`), ativo, whatsapp, ultimoLeadEm
- **Property**: id, `code` (único, 1–50 caracteres, estável, vira o `ListingID`), título, descrição, `purpose` (`SALE` | `RENT` | `SALE_RENT`), tipo e subtipo, preçoVenda, preçoAluguel, condomínio, IPTU, áreaÚtil, áreaTotal, quartos, suítes, banheiros, vagas, endereço completo (CEP, estado, cidade, bairro, rua, número, complemento, lat, lng), `displayAddress` (`ALL` | `STREET` | `NEIGHBORHOOD`), `publicationType`, `publishToPortals` (bool), timestamps
- **PropertyPhoto**: id, propertyId, `storageKey`, ordem, `isPrimary`, legenda
- **Lead**: id, `source` (`GRUPO_OLX` | `SITE` | `MANUAL`), `originLeadId` (único por source), `clientListingId`, propertyId?, nome, email, ddd, telefone, mensagem, `transactionType` (`RENT` | `SELL` | null), `leadType`, `temperature`, `queue` (`RENTAL` | `SALES` | `TRIAGE`), agentId?, `routingReason`, `rawPayload` (JSON), status, timestamps

Valores monetários em centavos (inteiro). Nunca usar float para dinheiro.

## Regras do feed VRSync (Grupo OLX)

Documentação oficial: https://developers.grupozap.com/feeds/integration.html
**Antes de implementar, consulte as páginas Header, Listing e Details e o validador oficial** (https://developers.grupozap.com/feeds/xml_validator/). As regras abaixo foram levantadas na pesquisa; se a documentação divergir, a documentação vence.

- Raiz `ListingDataFeed` com namespace `http://www.vivareal.com/schemas/1.0/VRSync`
- `ListingID`: 1 a 50 caracteres, único → usar `Property.code`
- `Title`: 10 a 100 caracteres, sem HTML, em CDATA
- `TransactionType`: `For Sale` (só `ListPrice`), `For Rent` (só `RentalPrice`), `Sale/Rent` (os dois)
- `Location`: `PostalCode` obrigatório; mínimo Country, State (com `abbreviation`), City, Neighborhood; atributo `displayAddress` = `All` | `Street` | `Neighborhood`; textos com acento em CDATA
- `Media`: mínimo 5 imagens JPG, até 7 MB cada, exatamente uma `primary="true"`; vídeo só YouTube, um por imóvel
- **URL de foto imutável:** o portal identifica a foto pela URL. Ao trocar a imagem, gerar nova `storageKey`/URL (ex.: incluir hash do conteúdo no nome)
- `ContactInfo`: nome e e-mail da imobiliária obrigatórios (vêm de configuração)
- `PublicationType`: `STANDARD` por padrão
- Encoding UTF-8; limite de 50 mil anúncios por arquivo
- O portal processa o feed a cada ~12 h: o feed deve ser estável, rápido (cache) e só incluir imóveis com `publishToPortals = true` **e** sem pendências

A validação de pendências fica em `properties/portal-readiness.ts` como função pura, testada, e é usada tanto no feed quanto no painel (mostrar ao usuário o que falta).

## Regras do webhook de leads (Grupo OLX)

Documentação oficial: https://developers.grupozap.com/webhooks/integration_leads.html
Consultar também a página de Segurança (https://developers.grupozap.com/webhooks/security.html) para definir a autenticação. Até lá, proteger a rota com um token secreto configurável.

Payload (POST JSON, um lead por requisição):
`leadOrigin`, `timestamp`, `originLeadId`, `originListingId`, `clientListingId`, `name`, `email`, `ddd`, `phone`, `phoneNumber` (depreciado), `message`, `temperature` (`Baixa`|`Média`|`Alta`), `transactionType` (`RENT`|`SELL`), `extraData` { `leadCerto`, `izi`, `feedback`, `leadType`, `mcmv` }.

Comportamento obrigatório:
- Responder **2xx** somente quando o lead foi persistido. O portal ignora o corpo da resposta e só olha o status
- Qualquer outro status faz o portal reenviar até 3 vezes → o endpoint **precisa ser idempotente** por `originLeadId`. Lead repetido retorna 200 sem duplicar
- Lead de anúncio (`leadOrigin = "Grupo OLX"`) sem `clientListingId` → **400**
- Lead `MCMV_OLX` não tem `clientListingId` nem `originListingId` → aceitar normalmente
- Guardar sempre o payload bruto em `rawPayload`
- Persistir rápido e responder; o roteamento roda em job BullMQ

## Roteamento de leads (o coração do teste)

Função pura em `leads/routing.ts`, com testes cobrindo todos os casos:

1. `transactionType = RENT` → fila `RENTAL`
2. `transactionType = SELL` → fila `SALES`
3. Sem `transactionType` → usar a finalidade do imóvel encontrado por `clientListingId`: `RENT` → `RENTAL`, `SALE` → `SALES`
4. Imóvel `SALE_RENT` sem `transactionType`, imóvel não encontrado ou qualquer ambiguidade → fila `TRIAGE` (nunca chutar)
5. `MCMV_OLX` → `SALES`
6. `leadCerto = true` → seguir a regra 1/2 (o lead é de imóvel semelhante, não do nosso); marcar no lead
7. Gravar sempre `routingReason` legível (ex.: "transactionType=RENT do portal")

Após definir a fila, atribuir corretor por **roleta**: o corretor ativo da fila com `ultimoLeadEm` mais antigo. Sem corretor ativo → lead fica na fila sem dono.

Notificação ao corretor fica atrás de uma interface `LeadNotifier`. Implementar só `LogNotifier` (log estruturado com o link de WhatsApp `https://wa.me/55<ddd><telefone>`). A API oficial do WhatsApp entra depois.

## Painel

- Login (JWT em cookie httpOnly)
- **Imóveis:** lista com filtro e um badge "Pronto para portais" ou "N pendências"; formulário com upload e ordenação de fotos e marcação da principal; preenchimento de endereço por CEP (ViaCEP)
- **Leads:** duas colunas/abas, **Locação** e **Vendas**, mais **Triagem**; cada card mostra origem, canal (`leadType`), imóvel, corretor, motivo do roteamento e botão de WhatsApp; ação de mover manualmente de fila
- **Corretores:** CRUD com fila e ativo/inativo
- **Feed:** página que mostra a URL do feed, quantos imóveis entram e quais ficaram de fora e por quê

Interface em português, limpa e responsiva. Sem lógica de negócio no front; regras ficam na API ou em `packages/shared`.

## Seed e demo

O seed deve criar:
- 1 admin, 2 corretores de locação, 2 de vendas
- 8 imóveis realistas (Vila Velha e Vitória/ES): 3 para venda, 3 para locação, 1 para venda e locação, 1 incompleto (para mostrar pendências)
- Fotos de exemplo (placeholders JPG gerados localmente, nunca imagens com direitos autorais)

`scripts/simulate-lead.ts` envia ao webhook: um lead RENT, um SELL, um sem `transactionType` de imóvel `SALE_RENT` (vai para triagem), um MCMV, um duplicado (mesmo `originLeadId`) e um inválido sem `clientListingId`. Imprimir o status HTTP de cada um.

`README.md` deve trazer um **roteiro de demonstração de 5 minutos** para apresentar ao Matheus.

## Comandos

```bash
pnpm install
docker compose up -d          # postgres, redis, minio
pnpm db:migrate && pnpm db:seed
pnpm dev                      # api em :3333, painel em :3000
pnpm test
pnpm simulate:leads
```

Manter esses comandos funcionando. Variáveis em `.env.example` documentadas; nunca commitar `.env`.

## Convenções

- TypeScript `strict`, sem `any`; validar toda entrada externa com Zod
- Código em inglês (nomes de variáveis, funções, tabelas); textos da interface e mensagens ao usuário em português
- Datas em UTC no banco, exibidas em America/Sao_Paulo
- Logs estruturados (pino) com `leadId`/`propertyId`; nunca logar dados pessoais completos fora do `rawPayload`
- Erros de domínio como exceções próprias mapeadas para HTTP em um filtro global
- Funções de regra de negócio puras e testadas; I/O nas bordas

## Ordem de implementação

1. Monorepo, Docker Compose, Prisma, healthcheck, lint e testes rodando
2. Auth + corretores
3. Imóveis + fotos (MinIO) + `portal-readiness` com testes
4. Gerador VRSync com testes de snapshot; validar um XML gerado no validador oficial
5. Webhook de leads + idempotência + testes e2e
6. Roteamento + roleta + job BullMQ com testes
7. Painel (imóveis → leads → feed)
8. Seed, simulador, README com roteiro de demo

Ao final de cada etapa: testes passando, commit, e uma linha no `CHANGELOG.md`.

## Definição de pronto do teste

- [ ] `docker compose up` + comandos acima sobem tudo do zero sem erro
- [ ] XML do feed passa no validador oficial do Grupo OLX
- [ ] Imóvel incompleto não entra no feed e o painel mostra o motivo
- [ ] Simulador: RENT cai em Locação, SELL em Vendas, ambíguo em Triagem, duplicado não duplica, inválido recebe 400
- [ ] Testes de `portal-readiness`, gerador VRSync, webhook e `routing` passando
- [ ] README com roteiro de demo
