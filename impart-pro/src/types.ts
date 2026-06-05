// src/types.ts

import type { } from 'koishi-plugin-monetary';
import type { } from 'koishi-plugin-puppeteer';
import type { } from 'koishi-plugin-glyph';

// Define the impartpro table structure.
export interface ImpartproTable {
  userid: string;
  username: string;
  channelId: string[];
  length: number;
  injectml: string;
  growthFactor: number;
  lastGrowthTime: string; // 开导间隔
  lastDuelTime: string; // 决斗间隔
  locked: boolean;
}

declare module 'koishi' {
  interface Tables {
    impartpro: ImpartproTable;
  }
}
