
export type Duration = 'Clip (30s)' | 'Pro';
export type LyricsOption = 'Auto' | 'Custom' | 'Instrumental';

export interface ExampleSong {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  prompt: string;
  duration: string;
  tags: string[];
}

export type GenerationStatus = 'idle' | 'generating' | 'completed' | 'error';

export interface SongResult {
  id: string;
  status: GenerationStatus;
  logs: string[];
  audioUrl: string | null;
  coverImageUrl: string | null;
  title: string | null;
  lyrics: string;
  metadata: string;
  fullPrompt: string | null;
  error: string | null;
  duration: Duration;
  timestamp: Date;
  isExpanded: boolean;
  // Storage for retries
  originalPrompt: string;
  originalDuration: Duration;
  originalLyricsOption: LyricsOption;
}

export interface GenerationState {
  results: SongResult[];
}
