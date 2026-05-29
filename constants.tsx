/**
 * Global Constants and Configuration Data
 * 
 * This file contains static data used throughout the Lyria Studio application,
 * including configuration options for the Prompt Builder (moods, genres, themes),
 * a list of example songs for the gallery, and a collection of SVG icons as React components.
 */
import React from 'react';
import { ExampleSong } from './types';

/**
 * Configuration for the Prompt Builder helper tool.
 * Provides predefined lists of musical attributes to help users construct prompts.
 */
export const PROMPT_HELPER_CONFIG = {
  moods: ['Epic', 'Groovy', 'Melancholic', 'Aggressive', 'Ethereal', 'Uplifting', 'Cinematic', 'Nostalgic', 'Energetic', 'Dreamy', 'Dark', 'Hopeful', 'Mysterious', 'Playful', 'Tense', 'Serene'],
  genders: ['Lo-fi', 'Rock', 'Disco', 'Robot', 'Metal', 'Choir', 'Rap', 'Jazz', 'Synthwave', 'Classical', 'Techno', 'Folk', 'R&B', 'Country', 'Ambient'],
  themes: ['Midnight City', 'Lost Love', 'Galaxy Exploration', 'Morning Coffee', 'Cyberpunk Future', 'Ocean Waves', 'Digital Dreams', 'Summer Sunset', 'Neon Rain', 'Deep Space', 'Ancient Ruins', 'Mountain Peak', 'Urban Jungle', 'Time Travel', 'Winter Solstice'],
  timestamps: ['0:10', '0:20', '0:30', '0:45', '1:00', '1:15', '1:30', '2:00'],
  bpms: ['80 BPM', '100 BPM', '120 BPM', '128 BPM', '140 BPM', '160 BPM', '172 BPM'],
  scales: ['C Major', 'A Minor', 'G Major', 'E Minor', 'D Minor', 'F Major', 'Blues Scale', 'Phrygian']
};

export const EXAMPLE_SONGS: ExampleSong[] = [
  {
    id: '1',
    title: 'Neon Horizons',
    artist: 'Lyria Synth',
    coverUrl: 'https://picsum.photos/seed/music1/400/400',
    prompt: 'A high-energy synthwave track with driving basslines, shimmering 80s pads, and a cinematic build-up. Suggests a late-night drive through a futuristic cityscape.',
    duration: '3:45',
    tags: ['Electronic', 'Synthwave', 'Cinematic']
  },
  {
    id: '2',
    title: 'Midnight Jazz Lounge',
    artist: 'Echo Blue',
    coverUrl: 'https://picsum.photos/seed/music2/400/400',
    prompt: 'Soft acoustic jazz with a smooth saxophone lead, light brush drums, and a warm upright bass. Intimate atmosphere with a touch of melancholy.',
    duration: '2:30',
    tags: ['Jazz', 'Acoustic', 'Chill']
  },
  {
    id: '3',
    title: 'Digital Raindrops',
    artist: 'Pixel Pulse',
    coverUrl: 'https://picsum.photos/seed/music3/400/400',
    prompt: 'Experimental IDM featuring glitchy textures, rhythmic water drop samples, and ethereal vocal chops. Dynamic and evolving soundscape.',
    duration: '4:12',
    tags: ['IDM', 'Experimental', 'Ambient']
  },
  {
    id: '4',
    title: 'Desert Mirage',
    artist: 'Solar Winds',
    coverUrl: 'https://picsum.photos/seed/music4/400/400',
    prompt: 'A slow, atmospheric ambient track with sweeping pads, distant echoing guitar, and subtle wind sound effects. Evokes a feeling of vast, empty spaces.',
    duration: '5:05',
    tags: ['Ambient', 'Atmospheric', 'Chill']
  },
  {
    id: '5',
    title: 'Cybernetic Rebellion',
    artist: 'Null Pointer',
    coverUrl: 'https://picsum.photos/seed/music5/400/400',
    prompt: 'Aggressive industrial techno with distorted kick drums, metallic clangs, and a fast, driving tempo. High energy and intense.',
    duration: '3:15',
    tags: ['Techno', 'Industrial', 'Aggressive']
  },
  {
    id: '6',
    title: 'Summer Breeze',
    artist: 'The Sunflowers',
    coverUrl: 'https://picsum.photos/seed/music6/400/400',
    prompt: 'An uplifting indie pop song with bright acoustic guitars, a catchy whistling melody, and a light, bouncy rhythm. Cheerful and carefree.',
    duration: '2:50',
    tags: ['Indie Pop', 'Uplifting', 'Acoustic']
  }
];

export const Icons = {
  Play: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  Pause: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
  ),
  Info: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  Sparkles: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707" />
    </svg>
  ),
  ChevronRight: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  ChevronDown: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  Loading: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  ),
  Download: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  Video: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  RefreshCw: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  Camera: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  X: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
};