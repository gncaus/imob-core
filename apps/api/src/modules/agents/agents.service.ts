import { Injectable } from '@nestjs/common';
import type { AgentDto, AgentListQuery, CreateAgentData, UpdateAgentData } from '@imob/shared';
import { hashPassword } from '../../common/auth/password.js';
import { ConflictError, NotFoundError } from '../../common/errors/domain-errors.js';
import { isRecordNotFound, isUniqueViolation } from '../../common/errors/prisma-errors.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

const agentWithUser = { user: { select: { name: true, email: true } } } as const;

type AgentWithUser = Prisma.AgentGetPayload<{ include: typeof agentWithUser }>;

function toDto(agent: AgentWithUser): AgentDto {
  return {
    id: agent.id,
    userId: agent.userId,
    name: agent.user.name,
    email: agent.user.email,
    queue: agent.queue,
    whatsapp: agent.whatsapp,
    active: agent.active,
    lastLeadAt: agent.lastLeadAt?.toISOString() ?? null,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  };
}

const emailTaken = () => new ConflictError('Já existe um usuário com este e-mail');
const agentNotFound = () => new NotFoundError('Corretor não encontrado');

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AgentListQuery): Promise<AgentDto[]> {
    const agents = await this.prisma.agent.findMany({
      where: { queue: query.queue, active: query.active },
      include: agentWithUser,
      orderBy: [{ queue: 'asc' }, { user: { name: 'asc' } }],
    });
    return agents.map(toDto);
  }

  async get(id: string): Promise<AgentDto> {
    const agent = await this.prisma.agent.findUnique({ where: { id }, include: agentWithUser });
    if (!agent) throw agentNotFound();
    return toDto(agent);
  }

  async create(data: CreateAgentData): Promise<AgentDto> {
    const passwordHash = await hashPassword(data.password);
    try {
      const agent = await this.prisma.agent.create({
        data: {
          queue: data.queue,
          whatsapp: data.whatsapp,
          active: data.active,
          user: {
            create: { name: data.name, email: data.email, passwordHash, role: 'AGENT' },
          },
        },
        include: agentWithUser,
      });
      return toDto(agent);
    } catch (error) {
      if (isUniqueViolation(error)) throw emailTaken();
      throw error;
    }
  }

  async update(id: string, data: UpdateAgentData): Promise<AgentDto> {
    const { name, email, password, queue, whatsapp, active } = data;
    const passwordHash = password === undefined ? undefined : await hashPassword(password);
    try {
      const agent = await this.prisma.agent.update({
        where: { id },
        data: {
          queue,
          whatsapp,
          active,
          user: { update: { name, email, passwordHash } },
        },
        include: agentWithUser,
      });
      return toDto(agent);
    } catch (error) {
      if (isUniqueViolation(error)) throw emailTaken();
      if (isRecordNotFound(error)) throw agentNotFound();
      throw error;
    }
  }

  /**
   * Exclui o corretor e o usuário dele. Corretor com leads não pode ser excluído, para não
   * perder o histórico de atendimento: nesse caso ele deve ser desativado.
   */
  async remove(id: string): Promise<void> {
    const agent = await this.prisma.agent.findUnique({
      where: { id },
      select: { userId: true, _count: { select: { leads: true } } },
    });
    if (!agent) throw agentNotFound();
    if (agent._count.leads > 0) {
      throw new ConflictError('O corretor possui leads. Desative-o em vez de excluir.');
    }
    await this.prisma.user.delete({ where: { id: agent.userId } });
  }
}
