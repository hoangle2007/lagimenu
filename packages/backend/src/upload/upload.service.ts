import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { v4 as uuidv4 } from 'uuid';

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class UploadService {
  private s3Client: S3Client;
  private bucketName: string;
  private publicUrl: string;

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: this.configService.get<string>('R2_ENDPOINT') || '',
      credentials: {
        accessKeyId: this.configService.get<string>('R2_ACCESS_KEY_ID') || '',
        secretAccessKey:
          this.configService.get<string>('R2_SECRET_ACCESS_KEY') || '',
      },
    });
    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME') || '';
    this.publicUrl = this.configService.get<string>('R2_PUBLIC_URL') || '';
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Vui lòng gửi file ảnh hợp lệ.');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('Ảnh tối đa 5MB.');
    }
    const mime = (file.mimetype || '').toLowerCase();
    if (!ALLOWED_IMAGE_MIMES.has(mime)) {
      throw new BadRequestException('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.');
    }

    const extFromMime =
      mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'webp';
    const rawExt = file.originalname.split('.').pop()?.toLowerCase();
    const fileExtension =
      rawExt && ['jpg', 'jpeg', 'png', 'webp'].includes(rawExt)
        ? rawExt === 'jpeg'
          ? 'jpg'
          : rawExt
        : extFromMime;
    const fileName = `${uuidv4()}.${fileExtension}`;

    const localDir = this.configService.get<string>('UPLOAD_LOCAL_DIR')?.trim();
    if (localDir) {
      const dir = resolve(
        localDir.startsWith('.') ? join(process.cwd(), localDir) : localDir,
      );
      const filePath = join(dir, fileName);
      writeFileSync(filePath, file.buffer);
      const publicBase =
        this.configService
          .get<string>('PUBLIC_WEB_ORIGIN')
          ?.replace(/\/$/, '') || '';
      return publicBase
        ? `${publicBase}/uploads/${fileName}`
        : `/uploads/${fileName}`;
    }

    if (!this.bucketName?.trim()) {
      throw new BadRequestException(
        'Chưa cấu hình upload: đặt UPLOAD_LOCAL_DIR (dev) hoặc R2_BUCKET_NAME + R2_ENDPOINT + keys + R2_PUBLIC_URL.',
      );
    }
    const endpoint = this.configService.get<string>('R2_ENDPOINT')?.trim();
    if (!endpoint) {
      throw new BadRequestException(
        'Chưa cấu hình R2_ENDPOINT (URL endpoint S3/R2).',
      );
    }

    const key = `uploads/${fileName}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: mime,
      }),
    );

    const base = (this.publicUrl || '').replace(/\/+$/, '');
    return base ? `${base}/${key}` : `/${key}`;
  }
}
