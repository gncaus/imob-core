# Deploy da demonstração (planos gratuitos, sem cartão)

| Peça             | Onde                                       | Observação                                                  |
| ---------------- | ------------------------------------------ | ----------------------------------------------------------- |
| Painel (Next.js) | Vercel                                     | deploy automático a cada push no `main`                     |
| API + worker     | Render (Docker, plano free)                | deploy automático a cada push; dorme após 15 min sem acesso |
| Redis (filas)    | Render Key Value (free)                    | criado junto com a API pelo `render.yaml`                   |
| PostgreSQL       | Neon (free)                                |                                                             |
| Fotos            | Supabase Storage (free, compatível com S3) |                                                             |

Na primeira subida, a API aplica as migrações e popula o banco vazio (seed), como no Docker local.

Nunca coloque senhas ou chaves neste repositório. Elas vão só nos painéis de cada plataforma.

## 1. Neon (banco)

1. Crie o projeto `imob-core` na região **AWS US East 2 (Ohio)**, só com _Postgres database_.
2. Em **Connect**, desligue o _connection pooling_ e copie a connection string. Ela termina em `?sslmode=require`. Esse valor é o `DATABASE_URL`.

## 2. Supabase (fotos)

1. Crie um projeto, de preferência na região **East US (Ohio)**.
2. Em **Storage**, crie o bucket **`imob-photos`** marcado como **Public bucket**. Os portais e o painel baixam as fotos por URL pública.
3. Em **Storage → Settings → S3 Connection**:
   - copie o **Endpoint** (`S3_ENDPOINT`) e a **Region** (`S3_REGION`);
   - em **S3 Access Keys → New access key**, gere a chave e copie o _Access key ID_ (`S3_ACCESS_KEY`) e o _Secret access key_ (`S3_SECRET_KEY`).
4. A URL pública das fotos é `https://<project-ref>.supabase.co/storage/v1/object/public/imob-photos`. Esse valor é o `PHOTOS_PUBLIC_BASE_URL`. O `<project-ref>` aparece no endereço do projeto.

## 3. Render (API + Redis)

1. Clique em **New → Blueprint** e conecte o repositório do GitHub. O Render lê o [`render.yaml`](render.yaml) e cria o `imob-api` e o `imob-redis`.
2. Preencha as variáveis pedidas:

   | Variável                                                     | Valor                                                                                                       |
   | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
   | `DATABASE_URL`                                               | connection string do Neon (passo 1)                                                                         |
   | `API_PUBLIC_URL`                                             | `https://imob-api.onrender.com`. Se o nome já estiver em uso, corrija depois com a URL que o Render mostrar |
   | `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Supabase (passo 2)                                                                                          |
   | `PHOTOS_PUBLIC_BASE_URL`                                     | URL pública do bucket (passo 2)                                                                             |
   | `SEED_ADMIN_PASSWORD`, `SEED_AGENT_PASSWORD`                 | senhas do admin e dos corretores da demo, com 8 caracteres ou mais                                          |

   O `JWT_SECRET` e o `GRUPO_OLX_WEBHOOK_SECRET` são gerados pelo próprio Render.

3. Aplique o Blueprint e espere o deploy. O primeiro deploy faz o build da imagem e leva alguns minutos. Quando terminar, `https://<sua-api>.onrender.com/health` deve responder `{"status":"ok",...}`.

## 4. Vercel (painel)

1. Clique em **Add New → Project** e importe o mesmo repositório.
2. Em **Root Directory**, escolha `apps/web`. O framework (Next.js) e o pnpm são detectados sozinhos.
3. Em **Environment Variables**, crie `API_URL` = URL da API no Render (sem barra no final).
4. Clique em **Deploy**. O painel chama a API pelo próprio domínio (`/api/*`), então o cookie de sessão funciona sem configurar CORS.

## 5. Manter a demo acordada

No GitHub, vá em **Settings → Secrets and variables → Actions → Variables** e crie `API_PUBLIC_URL` com a URL da API. O workflow [`keep-alive`](.github/workflows/keep-alive.yml) passa a acessar a API, o feed e uma foto a cada 14 minutos. Isso evita a espera de cerca de 1 minuto quando a API dorme e evita a pausa do Supabase.

## 6. Enviar leads de teste para a demo

O simulador roda da sua máquina, apontando para a API no ar. O `GRUPO_OLX_WEBHOOK_SECRET` está nas variáveis do serviço no Render.

```bash
SIMULATOR_API_URL=https://<sua-api>.onrender.com \
GRUPO_OLX_WEBHOOK_SECRET=<valor do Render> \
SEED_ADMIN_PASSWORD=<senha do admin> \
pnpm simulate:leads
```

## Atualizações

Cada push no `main` dispara o deploy da API (Render) e do painel (Vercel). Os dados do banco são preservados, porque o seed só roda com o banco vazio.
