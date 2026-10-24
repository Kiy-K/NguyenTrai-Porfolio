export interface ProductVideo {
  video?: string;
  muxAssetId?: string;
  muxPlaybackId?: string;
}

export interface ArticleReference {
  title: string;
  url?: string;
  author?: string;
  publisher?: string;
}

export interface Product {
  id: string | number;
  title: string;
  description: string;
  fullDescription?: string;
  images: string[];
  videos?: ProductVideo[];
  video?: string;
  muxAssetId?: string;
  muxPlaybackId?: string;
  tags?: string[];
  section?: string;
  createdAt?: string;
  status?: 'published' | 'draft' | 'archived';
  teamMembers?: string;
  references?: ArticleReference[];
}

export const products: Product[] = [];
