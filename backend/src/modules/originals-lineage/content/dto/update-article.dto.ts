import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArticleStatus } from './create-article.dto';

export class UpdateArticleDto {
  @ApiPropertyOptional({ example: '更新後的標題' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'updated-slug' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ example: '更新後的内容...' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ example: 'news' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: '• 修復問題\n• 新增功能' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({ example: 'https://example.com/new-cover.jpg' })
  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @ApiPropertyOptional({ example: 'https://example.com/bgm.mp3', description: '文章背景音樂 URL' })
  @IsOptional()
  @IsString()
  musicUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @ApiPropertyOptional({ enum: ArticleStatus })
  @IsOptional()
  @IsEnum(ArticleStatus)
  status?: ArticleStatus;
}
