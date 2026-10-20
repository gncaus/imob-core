import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/env.js';
import { PhotoStorage } from './photo-storage.js';

@Injectable()
export class S3PhotoStorage extends PhotoStorage implements OnModuleInit {
  private readonly logger = new Logger(S3PhotoStorage.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super();
    this.client = new S3Client({
      endpoint: config.S3_ENDPOINT,
      region: config.S3_REGION,
      credentials: { accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY },
      // MinIO usa caminho (endpoint/bucket/chave) em vez de subdomínio por bucket.
      forcePathStyle: true,
    });
    this.bucket = config.S3_BUCKET;
    this.publicBaseUrl = config.PHOTOS_PUBLIC_BASE_URL;
  }

  /**
   * Garante que o bucket existe e tem leitura pública (os portais baixam as fotos pela URL).
   * Falha aqui não derruba a API: só o upload de fotos fica indisponível, e o erro vai para o log.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.ensureBucket();
    } catch (error) {
      this.logger.error({ err: error, bucket: this.bucket }, 'Não foi possível preparar o bucket');
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // A chave inclui o hash do conteúdo, então o objeto nunca muda: pode ser cacheado para sempre.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  publicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }

  private async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return;
    } catch {
      // Bucket inexistente: cria abaixo.
    }
    await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    await this.client.send(
      new PutBucketPolicyCommand({
        Bucket: this.bucket,
        Policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.bucket}/*`],
            },
          ],
        }),
      }),
    );
    this.logger.log({ bucket: this.bucket }, 'Bucket de fotos criado com leitura pública');
  }
}
