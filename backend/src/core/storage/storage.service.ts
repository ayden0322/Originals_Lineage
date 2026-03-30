import { Injectable, OnModuleInit, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { v4 as uuid } from 'uuid';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client;
  private bucket: string;
  private publicUrl: string;
  private isReady = false;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get('MINIO_BUCKET', 'originals-uploads');
    this.publicUrl = this.configService.get(
      'MINIO_PUBLIC_URL',
      'http://localhost:9000',
    );

    const endpoint = this.configService.get('MINIO_ENDPOINT', 'minio');
    const port = parseInt(this.configService.get('MINIO_PORT', '9000'), 10);
    const useSSL = this.configService.get('MINIO_USE_SSL', 'false') === 'true';

    this.logger.log(`MinIO config: endpoint=${endpoint}, port=${port}, ssl=${useSSL}, bucket=${this.bucket}`);

    this.client = new Minio.Client({
      endPoint: endpoint,
      port,
      useSSL,
      accessKey: this.configService.get('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.configService.get('MINIO_SECRET_KEY', 'minioadmin'),
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Bucket "${this.bucket}" created`);
      }

      // Set public read policy
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucket}/*`],
          },
        ],
      };
      await this.client.setBucketPolicy(
        this.bucket,
        JSON.stringify(policy),
      );
      this.isReady = true;
      this.logger.log(`MinIO ready: bucket="${this.bucket}", publicUrl="${this.publicUrl}"`);
    } catch (error) {
      this.isReady = false;
      this.logger.error(`MinIO init failed: ${(error as Error).message}`);
    }
  }

  async upload(
    file: Express.Multer.File,
    folder = 'general',
  ): Promise<{ url: string; objectName: string }> {
    if (!this.isReady) {
      throw new BadRequestException('檔案儲存服務尚未就緒，請稍後再試或聯繫管理員');
    }

    const ext = file.originalname.split('.').pop();
    const objectName = `${folder}/${uuid()}.${ext}`;

    await this.client.putObject(
      this.bucket,
      objectName,
      file.buffer,
      file.size,
      { 'Content-Type': file.mimetype },
    );

    return {
      url: this.getPublicUrl(objectName),
      objectName,
    };
  }

  async delete(objectName: string): Promise<void> {
    await this.client.removeObject(this.bucket, objectName);
  }

  /** 列出指定資料夾下的所有檔案 */
  async listObjects(folder?: string): Promise<
    { objectName: string; url: string; size: number; lastModified: Date }[]
  > {
    if (!this.isReady) {
      throw new BadRequestException('檔案儲存服務尚未就緒');
    }

    const prefix = folder ? `${folder}/` : '';
    const stream = this.client.listObjectsV2(this.bucket, prefix, true);
    const items: { objectName: string; url: string; size: number; lastModified: Date }[] = [];

    return new Promise((resolve, reject) => {
      stream.on('data', (obj) => {
        if (obj.name) {
          items.push({
            objectName: obj.name,
            url: this.getPublicUrl(obj.name),
            size: obj.size,
            lastModified: obj.lastModified,
          });
        }
      });
      stream.on('end', () => resolve(items));
      stream.on('error', (err) => reject(err));
    });
  }

  getPublicUrl(objectName: string): string {
    return `${this.publicUrl}/${this.bucket}/${objectName}`;
  }
}
