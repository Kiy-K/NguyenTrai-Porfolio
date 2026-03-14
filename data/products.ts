export interface Product {
  id: string | number;
  title: string;
  description: string;
  fullDescription?: string;
  images: string[];
  video?: string;
  tags?: string[];
  section?: string;
  createdAt?: string;
  status?: 'published' | 'draft' | 'archived';
  teamMembers?: string;
}

export const products: Product[] = [];
