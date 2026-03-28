import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ArticleStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export class CreateArticleDto {
  @ApiProperty({ example: '新手攻略指南' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'beginner-guide' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ example: '文章内容...' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ example: 'news' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: '• 修復登入問題\n• 新增活動副本', description: '更新摘要（列點式）' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({ example: 'https://example.com/cover.jpg' })
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional({ enum: ArticleStatus, default: ArticleStatus.DRAFT })
  @IsOptional()
  @IsEnum(ArticleStatus)
  status?: ArticleStatus;
}
