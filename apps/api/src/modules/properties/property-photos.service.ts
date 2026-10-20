import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { PropertyPhotoDto, ReorderPhotosData, UpdatePhotoData } from '@imob/shared';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../common/errors/domain-errors.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { PhotoStorage } from '../../common/storage/photo-storage.js';
import { PHOTO_CONTENT_TYPE, PHOTO_MAX_BYTES } from './portal-readiness.js';
import { photosInOrder, toPhotoDto } from './property.mapper.js';
import { propertyNotFound } from './properties.service.js';

export interface UploadedPhoto {
  buffer: Buffer;
  size: number;
}

const photoNotFound = () => new NotFoundError('Foto não encontrada');

/** Todo JPEG começa com o marcador SOI (FF D8) seguido de outro marcador (FF). */
function isJpeg(buffer: Buffer): boolean {
  return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

/**
 * A chave inclui o hash do conteúdo: trocar a imagem gera chave e URL novas, como o portal exige
 * (ele identifica a foto pela URL).
 */
export function photoStorageKey(propertyId: string, content: Buffer): string {
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 32);
  return `properties/${propertyId}/${hash}.jpg`;
}

@Injectable()
export class PropertyPhotosService {
  private readonly logger = new Logger(PropertyPhotosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PhotoStorage,
  ) {}

  async upload(propertyId: string, file: UploadedPhoto | undefined): Promise<PropertyPhotoDto> {
    if (!file)
      throw new ValidationError([{ path: 'file', message: 'Envie a foto no campo "file"' }]);
    if (!isJpeg(file.buffer)) {
      throw new ValidationError([{ path: 'file', message: 'Os portais só aceitam fotos em JPG' }]);
    }
    if (file.size > PHOTO_MAX_BYTES) {
      throw new ValidationError([{ path: 'file', message: 'A foto deve ter no máximo 7 MB' }]);
    }

    await this.ensurePropertyExists(propertyId);
    const storageKey = photoStorageKey(propertyId, file.buffer);
    if (await this.prisma.propertyPhoto.findUnique({ where: { storageKey } })) {
      throw new ConflictError('Esta foto já foi enviada para este imóvel');
    }

    await this.storage.put(storageKey, file.buffer, PHOTO_CONTENT_TYPE);
    try {
      const photo = await this.prisma.$transaction(async (tx) => {
        const last = await tx.propertyPhoto.findFirst({
          where: { propertyId },
          orderBy: { position: 'desc' },
          select: { position: true },
        });
        const hasPrimary = await tx.propertyPhoto.count({ where: { propertyId, isPrimary: true } });
        return tx.propertyPhoto.create({
          data: {
            propertyId,
            storageKey,
            contentType: PHOTO_CONTENT_TYPE,
            sizeBytes: file.size,
            position: (last?.position ?? -1) + 1,
            // A primeira foto do imóvel vira a principal automaticamente.
            isPrimary: hasPrimary === 0,
          },
        });
      });
      return toPhotoDto(photo, this.storage);
    } catch (error) {
      await this.storage.delete(storageKey).catch(() => undefined);
      throw error;
    }
  }

  async update(
    propertyId: string,
    photoId: string,
    data: UpdatePhotoData,
  ): Promise<PropertyPhotoDto> {
    await this.findPhoto(propertyId, photoId);
    const photo = await this.prisma.$transaction(async (tx) => {
      if (data.isPrimary) {
        await tx.propertyPhoto.updateMany({
          where: { propertyId, isPrimary: true },
          data: { isPrimary: false },
        });
      }
      return tx.propertyPhoto.update({
        where: { id: photoId },
        data: { caption: data.caption, isPrimary: data.isPrimary },
      });
    });
    return toPhotoDto(photo, this.storage);
  }

  /** Recebe todos os ids das fotos do imóvel na nova ordem. */
  async reorder(propertyId: string, { photoIds }: ReorderPhotosData): Promise<PropertyPhotoDto[]> {
    await this.ensurePropertyExists(propertyId);
    const current = await this.prisma.propertyPhoto.findMany({
      where: { propertyId },
      select: { id: true },
    });
    const currentIds = new Set(current.map((photo) => photo.id));
    const sameSet =
      photoIds.length === currentIds.size &&
      new Set(photoIds).size === photoIds.length &&
      photoIds.every((id) => currentIds.has(id));
    if (!sameSet) {
      throw new ValidationError([
        { path: 'photoIds', message: 'Envie todas as fotos do imóvel, cada uma uma única vez' },
      ]);
    }

    await this.prisma.$transaction(
      photoIds.map((id, position) =>
        this.prisma.propertyPhoto.update({ where: { id }, data: { position } }),
      ),
    );
    const photos = await this.prisma.propertyPhoto.findMany({
      where: { propertyId },
      ...photosInOrder,
    });
    return photos.map((photo) => toPhotoDto(photo, this.storage));
  }

  /** Remove a foto; se era a principal, a próxima na ordem assume. */
  async remove(propertyId: string, photoId: string): Promise<void> {
    const photo = await this.findPhoto(propertyId, photoId);
    await this.prisma.$transaction(async (tx) => {
      await tx.propertyPhoto.delete({ where: { id: photoId } });
      if (!photo.isPrimary) return;
      const next = await tx.propertyPhoto.findFirst({
        where: { propertyId },
        orderBy: { position: 'asc' },
        select: { id: true },
      });
      if (next)
        await tx.propertyPhoto.update({ where: { id: next.id }, data: { isPrimary: true } });
    });
    await this.storage.delete(photo.storageKey).catch((error: unknown) => {
      this.logger.warn(
        { err: error, propertyId, storageKey: photo.storageKey },
        'Falha ao apagar foto',
      );
    });
  }

  private async ensurePropertyExists(propertyId: string): Promise<void> {
    const count = await this.prisma.property.count({ where: { id: propertyId } });
    if (count === 0) throw propertyNotFound();
  }

  private async findPhoto(propertyId: string, photoId: string) {
    const photo = await this.prisma.propertyPhoto.findFirst({ where: { id: photoId, propertyId } });
    if (!photo) throw photoNotFound();
    return photo;
  }
}
