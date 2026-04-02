import { Injectable, OnModuleInit, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { v4 as uuid } from 'uuid';
import { execFile } from 'child_process';
import { writeFile, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

/** 需要做 faststart 處理的影片 MIME types */
const VIDEO_MIMETYPES = new Set([
  'video/mp4',
  'video/quicktime', // .mov
  'video/x-m4v',
]);

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

    let buffer = file.buffer;
    let size = file.size;

    // MP4/MOV 影片：自動做 faststart（將 moov atom 移到檔案開頭）
    if (VIDEO_MIMETYPES.has(file.mimetype)) {
      try {
        const result = await this.processVideoFaststart(file.buffer);
        buffer = result;
        size = result.length;
        this.logger.log(`Video faststart processed: ${file.originalname} (${file.size} → ${size} bytes)`);
      } catch (err) {
        this.logger.warn(`Video faststart failed, uploading original: ${(err as Error).message}`);
        // fallback: 上傳原始檔案
      }
    }

    await this.client.putObject(
      this.bucket,
      objectName,
      buffer,
      size,
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

  /**
   * 處理影片：
   * 1. 偵測 video codec，若非 H.264 則重新編碼為 H.264 + AAC（瀏覽器相容）
   * 2. 加上 faststart（moov atom 在前面，支援串流播放）
   */
  private async processVideoFaststart(inputBuffer: Buffer): Promise<Buffer> {
    const id = uuid();
    const inputPath = join(tmpdir(), `upload-${id}-input.mp4`);
    const outputPath = join(tmpdir(), `upload-${id}-output.mp4`);

    try {
      await writeFile(inputPath, inputBuffer);

      // 先偵測 codec
      const codec = await this.detectVideoCodec(inputPath);
      const needsReencode = codec !== 'h264';

      if (needsReencode) {
        this.logger.log(`Video codec is "${codec}", re-encoding to H.264 for browser compatibility`);
      }

      const ffmpegArgs = [
        '-i', inputPath,
        ...(needsReencode
          ? ['-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-b:a', '192k']
          : ['-c', 'copy']),
        '-movflags', '+faststart',
        '-y',
        outputPath,
      ];

      await new Promise<void>((resolve, reject) => {
        execFile(
          'ffmpeg',
          ffmpegArgs,
          { timeout: 300_000 },  // 重新編碼可能較久，5 分鐘超時
          (error, _stdout, stderr) => {
            if (error) {
              this.logger.warn(`ffmpeg stderr: ${stderr}`);
              reject(error);
            } else {
              resolve();
            }
          },
        );
      });

      return await readFile(outputPath);
    } finally {
      // 清理暫存檔
      await unlink(inputPath).catch(() => {});
      await unlink(outputPath).catch(() => {});
    }
  }

  /** 用 ffprobe 偵測影片的 video codec 名稱 */
  private async detectVideoCodec(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        'ffprobe',
        [
          '-v', 'error',
          '-select_streams', 'v:0',
          '-show_entries', 'stream=codec_name',
          '-of', 'csv=p=0',
          filePath,
        ],
        { timeout: 10_000 },
        (error, stdout) => {
          if (error) {
            reject(error);
          } else {
            resolve(stdout.trim());
          }
        },
      );
    });
  }
}
