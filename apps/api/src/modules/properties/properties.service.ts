import { Injectable, Logger } from '@nestjs/common';
import type {
  CreatePropertyData,
  PropertyDto,
  PropertyListQuery,
  PropertySummaryDto,
  UpdatePropertyData,
} from '@imob/shared';
import { ConflictError, NotFoundError } from '../../common/errors/domain-errors.js';
import { isRecordNotFound, isUniqueViolation } from '../../common/errors/prisma-errors.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { PhotoStorage } from '../../common/storage/photo-storage.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  photosInOrder,
  type PropertyWithPhotos,
  toPropertyDto,
  toPropertySummaryDto,
} from './property.mapper.js';

const withPhotos = { photos: photosInOrder } as const;

export const propertyNotFound = () => new NotFoundError('Imóvel não encontrado');
const codeTaken = () => new ConflictError('Já existe um imóvel com este código');

@Injectable()
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PhotoStorage,
  ) {}

  /**
   * O filtro `ready` é aplicado em memória porque as pendências são calculadas em código
   * (portal-readiness). Para o volume de uma imobiliária isso é suficiente.
   */
  async list(query: PropertyListQuery): Promise<PropertySummaryDto[]> {
    const where: Prisma.PropertyWhereInput = { purpose: query.purpose };
    if (query.search) {
      const contains = { contains: query.search, mode: 'insensitive' } as const;
      where.OR = [
        { code: contains },
        { title: contains },
        { neighborhood: contains },
        { city: contains },
      ];
    }
    const properties = await this.prisma.property.findMany({
      where,
      include: withPhotos,
      orderBy: { updatedAt: 'desc' },
    });
    const summaries = properties.map((property) => toPropertySummaryDto(property, this.storage));
    return query.ready === undefined
      ? summaries
      : summaries.filter((summary) => summary.readiness.ready === query.ready);
  }

  async get(id: string): Promise<PropertyDto> {
    return toPropertyDto(await this.findWithPhotos(id), this.storage);
  }

  async findWithPhotos(id: string): Promise<PropertyWithPhotos> {
    const property = await this.prisma.property.findUnique({ where: { id }, include: withPhotos });
    if (!property) throw propertyNotFound();
    return property;
  }

  async create(data: CreatePropertyData): Promise<PropertyDto> {
    try {
      const property = await this.prisma.property.create({ data, include: withPhotos });
      return toPropertyDto(property, this.storage);
    } catch (error) {
      if (isUniqueViolation(error)) throw codeTaken();
      throw error;
    }
  }

  async update(id: string, data: UpdatePropertyData): Promise<PropertyDto> {
    try {
      const property = await this.prisma.property.update({
        where: { id },
        data,
        include: withPhotos,
      });
      return toPropertyDto(property, this.storage);
    } catch (error) {
      if (isUniqueViolation(error)) throw codeTaken();
      if (isRecordNotFound(error)) throw propertyNotFound();
      throw error;
    }
  }

  /** Exclui o imóvel (fotos em cascata no banco) e depois os arquivos no storage. */
  async remove(id: string): Promise<void> {
    const property = await this.findWithPhotos(id);
    await this.prisma.property.delete({ where: { id } });
    await Promise.all(
      property.photos.map((photo) =>
        this.storage.delete(photo.storageKey).catch((error: unknown) => {
          // Arquivo órfão não afeta o feed (a foto já saiu do banco); fica só o registro no log.
          this.logger.warn(
            { err: error, propertyId: id, storageKey: photo.storageKey },
            'Falha ao apagar foto',
          );
        }),
      ),
    );
  }
}
