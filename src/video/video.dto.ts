export class CreateVideoDto {
  title: string;
  description: string;
  vimeoId: string;
  thumbnail: string;
}

export class UpdateVideoDto {
  title?: string;
  description?: string;
  vimeoId?: string;
  thumbnail?: string;
  isActive?: boolean;
}
