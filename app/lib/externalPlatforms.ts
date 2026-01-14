export type ExternalPlatform = {
  id: string;
  label: string;
  href: string;
  icon: 'instagram' | 'book';
};

export const externalPlatforms: ExternalPlatform[] = [
  {
    id: 'instagram',
    label: 'Instagram',
    href: 'https://example.com/instagram', // PLACEHOLDER — replace with real links later
    icon: 'instagram',
  },
  {
    id: 'literature',
    label: 'Literature',
    href: 'https://example.com/literature', // PLACEHOLDER — replace with real links later
    icon: 'book',
  },
];

