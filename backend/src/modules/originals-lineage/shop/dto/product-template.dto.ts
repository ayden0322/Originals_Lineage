import { IsString, IsObject, MaxLength, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PRODUCT_CATEGORIES, type ProductCategory } from './create-product.dto';

export class CreateProductTemplateDto {
  @ApiProperty({ example: '標準鑽石包範本' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ enum: PRODUCT_CATEGORIES })
  @IsIn(PRODUCT_CATEGORIES as unknown as string[])
  category: ProductCategory;

  @ApiProperty({
    description: '商品欄位快照（CreateProductDto 內容）',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  snapshot: Record<string, unknown>;
}

export class UpdateProductTemplateDto {
  @ApiProperty({ required: false })
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({ required: false, type: 'object', additionalProperties: true })
  @IsObject()
  snapshot?: Record<string, unknown>;
}
