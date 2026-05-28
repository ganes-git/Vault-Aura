export type KeyStrength = 'WEAK' | 'FAIR' | 'STRONG' | 'UNBREAKABLE';
export type KeyMode = 'alphanumeric' | 'passphrase' | 'pin';

export interface GeneratedKey {
  value: string;
  entropy: number;
  keyspace: bigint;
  crackTime: string;
  strength: KeyStrength;
  mode: KeyMode;
  timestamp: number;
  isStarred?: boolean;
}

export interface AlphaConfig {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

export interface PassphraseConfig {
  wordCount: number;
  separator: string;
  capitalization: 'lowercase' | 'titlecase' | 'uppercase';
}

export interface PinConfig {
  length: number;
  format: 'contiguous' | 'grouped';
  excludeSequential: boolean;
  excludeRepeated: boolean;
}
