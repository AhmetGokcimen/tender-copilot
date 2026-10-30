import data from './articles.json';
import type { Article, ArticleCopy, Lang } from './types';

export type { Article, ArticleCopy, Lang, Section, Source } from './types';

/** Published guides, newest first. Content lives in articles.json, in English and Romanian. */
export const RESOURCES = data as Article[];

export const getArticle = (slug: string): Article | undefined => RESOURCES.find((a) => a.slug === slug);

export const copyFor = (a: Article, lang: Lang): ArticleCopy => a[lang];

/** The other guides, for the "keep reading" list. */
export const related = (slug: string): Article[] => RESOURCES.filter((a) => a.slug !== slug);
