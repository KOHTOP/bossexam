import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface Article {
  id: number;
  title: string;
  slug: string;
  content: string;
  category: string;
  author: string;
  views: number;
  created_at: string;
  is_pinned?: number | boolean;
}
