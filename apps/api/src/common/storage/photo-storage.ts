/**
 * Armazenamento de fotos dos imóveis. Classe abstrata para servir de token de injeção:
 * hoje há só a implementação S3 (MinIO local); outra nuvem entra como nova implementação.
 */
export abstract class PhotoStorage {
  abstract put(key: string, body: Buffer, contentType: string): Promise<void>;

  abstract delete(key: string): Promise<void>;

  /** URL pública e estável da foto: é por ela que o portal identifica a imagem. */
  abstract publicUrl(key: string): string;
}
