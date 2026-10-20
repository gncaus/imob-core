/**
 * Simula o Grupo OLX enviando leads ao webhook, para a demonstração.
 * Uso: pnpm simulate:leads (com a API rodando e o seed aplicado).
 *
 * Envia os seis cenários do teste, imprime o status HTTP de cada um e, em seguida, consulta a API
 * para mostrar em qual fila e com qual corretor cada lead caiu.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const rootEnv = resolve(import.meta.dirname, '../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const API_URL = (process.env.SIMULATOR_API_URL ?? 'http://localhost:3333').replace(/\/+$/, '');
const SECRET = process.env.GRUPO_OLX_WEBHOOK_SECRET;
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@imob.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;

if (!SECRET) {
  console.error('Defina GRUPO_OLX_WEBHOOK_SECRET no .env (o mesmo usado pela API).');
  process.exit(1);
}

/** Sufixo por execução: cada rodada gera leads novos, e o duplicado repete o desta rodada. */
const run = Date.now().toString(36);

const base = {
  leadOrigin: 'Grupo OLX',
  timestamp: new Date().toISOString(),
  name: 'Cliente Simulado',
  email: 'cliente.simulado@example.com',
  ddd: '27',
  phone: '998887766',
  temperature: 'Alta',
};

const rentLead = {
  ...base,
  originLeadId: `sim-${run}-rent`,
  originListingId: '2001',
  clientListingId: 'VIX-202',
  name: 'Mariana Souza',
  message: 'Olá, quero alugar este apartamento. Ainda está disponível?',
  transactionType: 'RENT',
  extraData: { leadCerto: false, leadType: 'CLICK_WHATSAPP' },
};

interface Scenario {
  label: string;
  expectedStatus: number;
  expectedQueue?: string;
  payload: Record<string, unknown>;
}

const scenarios: Scenario[] = [
  {
    label: 'Lead de aluguel (transactionType=RENT)',
    expectedStatus: 201,
    expectedQueue: 'RENTAL',
    payload: rentLead,
  },
  {
    label: 'Lead de compra (transactionType=SELL)',
    expectedStatus: 201,
    expectedQueue: 'SALES',
    payload: {
      ...base,
      originLeadId: `sim-${run}-sell`,
      originListingId: '1001',
      clientListingId: 'VV-101',
      name: 'Rafael Lima',
      message: 'Tenho interesse em comprar. Aceita financiamento?',
      transactionType: 'SELL',
      extraData: { leadCerto: false, leadType: 'CONTACT_FORM' },
    },
  },
  {
    label: 'Imóvel de venda e locação sem transactionType',
    expectedStatus: 201,
    expectedQueue: 'TRIAGE',
    payload: {
      ...base,
      originLeadId: `sim-${run}-ambiguo`,
      originListingId: '2004',
      clientListingId: 'VIX-204',
      name: 'Juliana Rocha',
      message: 'Gostaria de mais informações sobre este imóvel.',
      temperature: 'Média',
      extraData: { leadCerto: false, leadType: 'CONTACT_CHAT' },
    },
  },
  {
    label: 'Lead MCMV (sem anúncio)',
    expectedStatus: 201,
    expectedQueue: 'SALES',
    payload: {
      leadOrigin: 'MCMV_OLX',
      timestamp: new Date().toISOString(),
      originLeadId: `sim-${run}-mcmv`,
      name: 'Pedro Henrique',
      email: 'pedro@example.com',
      ddd: '27',
      phone: '997776655',
      message: 'Simulação de financiamento MCMV realizada no portal.',
      temperature: 'Média',
      transactionType: 'SELL',
      extraData: { mcmv: { propertyValue: 250000, subsidyRange: 'FAIXA_1' } },
    },
  },
  {
    label: 'Reenvio do lead de aluguel (mesmo originLeadId)',
    expectedStatus: 200,
    payload: rentLead,
  },
  {
    label: 'Lead de anúncio sem clientListingId (inválido)',
    expectedStatus: 400,
    payload: { ...rentLead, originLeadId: `sim-${run}-invalido`, clientListingId: undefined },
  },
];

const QUEUE_LABEL: Record<string, string> = {
  RENTAL: 'Locação',
  SALES: 'Vendas',
  TRIAGE: 'Triagem',
};

interface LeadView {
  id: string;
  status: string;
  queue: string | null;
  routingReason: string | null;
  agent: { name: string } | null;
}

async function sendLead(payload: Record<string, unknown>) {
  const response = await fetch(`${API_URL}/webhooks/leads/grupo-olx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`grupozap:${SECRET}`).toString('base64')}`,
    },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as { id?: string };
  return { status: response.status, id: body.id };
}

/** Faz login como admin e devolve o cookie de sessão, para consultar o resultado do roteamento. */
async function adminCookie(): Promise<string | null> {
  if (!ADMIN_PASSWORD) return null;
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  return response.ok ? (response.headers.get('set-cookie')?.split(';')[0] ?? null) : null;
}

async function fetchLeads(cookie: string): Promise<LeadView[]> {
  const response = await fetch(`${API_URL}/leads`, { headers: { Cookie: cookie } });
  return response.ok ? ((await response.json()) as LeadView[]) : [];
}

/** O roteamento roda num job em segundo plano: espera os leads saírem de RECEIVED. */
async function waitForRouting(cookie: string, ids: string[]): Promise<Map<string, LeadView>> {
  const deadline = Date.now() + 15_000;
  let byId = new Map<string, LeadView>();
  while (Date.now() < deadline) {
    byId = new Map((await fetchLeads(cookie)).map((lead) => [lead.id, lead]));
    if (ids.every((id) => byId.get(id)?.status === 'ROUTED')) break;
    await new Promise((done) => setTimeout(done, 500));
  }
  return byId;
}

async function main(): Promise<void> {
  console.log(`Enviando leads para ${API_URL}/webhooks/leads/grupo-olx\n`);
  const sent: { scenario: Scenario; id?: string; ok: boolean }[] = [];

  for (const scenario of scenarios) {
    const { status, id } = await sendLead(scenario.payload);
    const ok = status === scenario.expectedStatus;
    sent.push({ scenario, id, ok });
    console.log(
      `${ok ? '✔' : '✘'} HTTP ${status} (esperado ${scenario.expectedStatus})  ${scenario.label}`,
    );
  }

  const cookie = await adminCookie();
  const routedIds = sent
    .filter((item) => item.scenario.expectedQueue && item.id)
    .map((item) => item.id!);
  if (cookie && routedIds.length > 0) {
    console.log('\nResultado do roteamento:');
    const leads = await waitForRouting(cookie, routedIds);
    for (const item of sent) {
      if (!item.scenario.expectedQueue || !item.id) continue;
      const lead = leads.get(item.id);
      const queue = lead?.queue ?? 'pendente';
      const ok = queue === item.scenario.expectedQueue;
      item.ok &&= ok;
      const agent = lead?.agent ? ` · corretor: ${lead.agent.name}` : ' · sem corretor';
      console.log(
        `${ok ? '✔' : '✘'} ${QUEUE_LABEL[queue] ?? queue}${agent}  (${lead?.routingReason ?? '—'})`,
      );
    }
  } else {
    console.log('\nDefina SEED_ADMIN_PASSWORD no .env para ver o resultado do roteamento.');
  }

  const failures = sent.filter((item) => !item.ok).length;
  console.log(
    failures === 0
      ? '\nTudo conforme o esperado.'
      : `\n${failures} cenário(s) diferente(s) do esperado.`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error: unknown) => {
  console.error(
    `Não foi possível falar com a API em ${API_URL}. Ela está rodando (pnpm dev)?`,
    error,
  );
  process.exitCode = 1;
});
