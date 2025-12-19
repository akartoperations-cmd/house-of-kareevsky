// Mock data for the intimate artist SPA
// TODO: Later support EN/ES/FR/IT variants and per-user language selection.

export interface Photo {
  id: string;
  url: string;
  date: string;
  time: string;
  description: string;
}

export interface Message {
  id: string;
  type: 'photo' | 'text' | 'sticker' | 'poll';
  time: string;
  createdAt?: string;
  imageUrl?: string;
  images?: string[];
  text?: string;
  subtitle?: string; // For sticker messages
  caption?: string; // For photo posts
  pollQuestion?: string;
  pollOptions?: string[];
}

export interface AudioItem {
  id: string;
  title: string;
  duration: string;
  type: 'voice' | 'music';
}

export interface Comment {
  id: string;
  author: string;
  text: string;
}

// Photos of the day
export const photos: Photo[] = [
  {
    id: '1',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop',
    date: 'Dec 8, 2025',
    time: '21:43',
    description:
      "Late night in the studio. The city sleeps but the music doesn't. Found this old piano in the corner — it still remembers songs I wrote years ago.",
  },
  {
    id: '2',
    url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop',
    date: 'Dec 7, 2025',
    time: '18:22',
    description:
      "Soundcheck before the show. That moment when everything goes quiet and you're alone with your thoughts.",
  },
  {
    id: '3',
    url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&h=600&fit=crop',
    date: 'Dec 5, 2025',
    time: '15:10',
    description: 'Writing new lyrics. Sometimes the best words come when you stop trying so hard.',
  },
  {
    id: '4',
    url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=600&fit=crop',
    date: 'Dec 3, 2025',
    time: '23:55',
    description: "After the concert. The crowd's energy still echoing in my ears.",
  },
];

// Messages for the feed
export const messages: Message[] = [
  {
    id: 'm1',
    type: 'text',
    time: '21:17',
    createdAt: '2025-12-13T21:17:00Z',
    text: 'Иногда я не нахожу слов — только ноты и молчание между ними ✨',
  },
  {
    id: 'm2',
    type: 'photo',
    time: '20:45',
    createdAt: '2025-12-13T20:45:00Z',
    imageUrl: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=400&h=300&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&h=600&fit=crop',
    ],
  },
  {
    id: 'm3',
    type: 'text',
    time: '19:30',
    createdAt: '2025-12-12T19:30:00Z',
    text: 'Пишу для тебя, хотя не знаю кто ты. Может быть это и есть настоящая свобода 🤍',
  },
  {
    id: 'm4',
    type: 'photo',
    time: '18:12',
    createdAt: '2025-12-12T18:12:00Z',
    imageUrl: 'https://images.unsplash.com/photo-1517842645767-c639042777db?w=400&h=300&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1517842645767-c639042777db?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=800&h=600&fit=crop',
    ],
  },
  {
    id: 'm5',
    type: 'text',
    time: '16:55',
    createdAt: '2025-12-12T16:55:00Z',
    text: 'Ночь, бумага, ручка. Больше ничего не нужно.',
  },
  {
    id: 'm6',
    type: 'text',
    time: '14:20',
    createdAt: '2025-12-11T14:20:00Z',
    text: 'Если бы я мог показать тебе то, что чувствую — я бы не писал песни 😊',
  },
  {
    id: 'm7',
    type: 'photo',
    time: '12:00',
    createdAt: '2025-12-11T12:00:00Z',
    imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&h=300&fit=crop',
    images: [
      'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1523419400524-2230b4c733b9?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&h=600&fit=crop',
    ],
  },
  {
    id: 'm8',
    type: 'text',
    time: '09:15',
    createdAt: '2025-12-11T09:15:00Z',
    text: 'Доброе утро. Сегодня будет хороший день — я это чувствую 🙏',
  },
  // Sticker messages (Type C)
  {
    id: 'm9',
    type: 'sticker',
    time: '22:30',
    createdAt: '2025-12-10T22:30:00Z',
    imageUrl: 'https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=400&h=300&fit=crop',
    subtitle: 'Тёплые носки и горячий чай — всё что нужно в такой вечер',
  },
  {
    id: 'm10',
    type: 'sticker',
    time: '17:45',
    createdAt: '2025-12-10T17:45:00Z',
    imageUrl: 'https://images.unsplash.com/photo-1544967082-d9d25d867d66?w=400&h=300&fit=crop',
    subtitle: 'Когда на улице холодно, а внутри уютно',
  },
  {
    id: 'm11',
    type: 'sticker',
    time: '11:20',
    createdAt: '2025-12-10T11:20:00Z',
    imageUrl: 'https://images.unsplash.com/photo-1513366208864-87536b8bd7b4?w=400&h=300&fit=crop',
    subtitle: 'Маленькие радости делают большие дни',
  },
];

// Audio items
export const audioItems: AudioItem[] = [
  { id: 'v1', title: 'Мысли вслух — о новом альбоме', duration: '3:42', type: 'voice' },
  { id: 'v2', title: 'Благодарность за поддержку', duration: '2:15', type: 'voice' },
  { id: 'v3', title: 'История одной песни', duration: '5:08', type: 'voice' },
  { id: 's1', title: 'Новая песня (demo)', duration: '4:21', type: 'music' },
  { id: 's2', title: 'Акустическая версия', duration: '3:55', type: 'music' },
  { id: 's3', title: 'Unreleased track', duration: '4:02', type: 'music' },
];

// Fake comments
export const fakeComments: Comment[] = [
  { id: 'c1', author: 'Мария', text: 'Это так красиво... Спасибо что делишься ❤️' },
  { id: 'c2', author: 'Алексей', text: 'Жду каждое твое сообщение!' },
  { id: 'c3', author: 'Анна', text: 'Читаю и плачу. Ты говоришь то, что я чувствую 🤍' },
];

// Emoji reactions
export const emojis = [
  '❤️',
  '😊',
  '😮',
  '😢',
  '✨',
  '🤍',
  '🤗',
  '🔥',
  '🎧',
  '🌙',
  '☕',
  '🎵',
  '👍',
  '😂',
  '😆',
  '🥰',
  '🤩',
  '🥲',
  '🤔',
  '🌅',
  '📷',
  '💌',
  '🌊',
  '😎',
  '🤞',
  '🥺',
  '😇',
  '🙌',
  '🤯',
  '💫',
  '🌸',
  '🍀',
  '🌧️',
];

export type PersonalMessageAuthor = 'artist' | 'listener';

export interface PersonalMessage {
  id: string;
  author: PersonalMessageAuthor;
  time: string;
  text: string;
  createdAt?: string;
  date?: string;
}

export const personalThread: PersonalMessage[] = [
  {
    id: 'p1',
    author: 'artist',
    time: '22:10',
    createdAt: '2025-12-09T22:10:00Z',
    text: 'Thank you for being here. I am writing this as if we were sitting in the same room.',
  },
  {
    id: 'p2',
    author: 'listener',
    time: '22:12',
    createdAt: '2025-12-09T22:12:00Z',
    text: 'I read every line. It feels like a late-night walk through the city.',
  },
  {
    id: 'p3',
    author: 'artist',
    time: '22:30',
    createdAt: '2025-12-09T22:30:00Z',
    text: 'Some messages are songs before they find their melody. This might be one of them.',
  },
  {
    id: 'p4',
    author: 'listener',
    time: '22:35',
    createdAt: '2025-12-09T22:35:00Z',
    text: 'Keep writing. I will keep listening.',
  },
];

export const artistMessage = {
  id: 'artist-1',
  title: 'A message from Kareevsky',
  preview: 'We are getting closer day by day...',
  fullText:
    'We are getting closer day by day. I write here as if it was a small living room — just between you and me.',
  time: '22:48',
};

