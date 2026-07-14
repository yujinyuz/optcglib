import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';

let db: Database | null = null;

export type WorkerMessage =
  | { type: 'init' }
  | { type: 'queryCards'; filters: QueryCardsFilters }
  | { type: 'queryPacks' }
  | { type: 'querySets' }
  | { type: 'queryBlocks' }
  | { type: 'getCardById'; id: string }
  | { type: 'getCardPacks'; cardId: string }
  | { type: 'getCardImages'; cardId: string }
  | { type: 'getRelatedCards'; cardId: string; types: string[]; limit?: number }
  | { type: 'getCardVariants'; cardId: string };

export type QueryCardsFilters = {
  search?: string;
  searchScope?: ('name' | 'effect' | 'trigger' | 'type')[];
  colors?: string[];
  categories?: string[];
  rarities?: string[];
  attributes?: string[];
  costMin?: number | null;
  costMax?: number | null;
  powerMin?: number | null;
  powerMax?: number | null;
  counterMin?: number | null;
  counterMax?: number | null;
  sets?: string[];
  blockMin?: number | null;
  blockMax?: number | null;
  hideVariants?: boolean;
  preferredLanguage?: 'english' | 'japanese';
  limit?: number;
  offset?: number;
};

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/* ── Query Builder ─────────────────────────────────────────────── */

class QueryBuilder {
  private ctes: Array<{ sql: string; params: (string | number | null)[] }> = [];
  private joins: string[] = [];
  private conditions: Array<{ sql: string; params: (string | number | null)[] }> = [];
  private orderCols = 'c.sort_order, c.id';

  private allParams(): (string | number | null)[] {
    const cteParams = this.ctes.flatMap((c) => c.params);
    const conditionParams = this.conditions.flatMap((c) => c.params);
    return [...cteParams, ...conditionParams];
  }

  withCte(name: string, sql: string, ...params: (string | number | null)[]) {
    this.ctes.push({ sql: `${name} AS (${sql})`, params });
    return this;
  }

  join(tableExpr: string) {
    this.joins.push(`JOIN ${tableExpr}`);
    return this;
  }

  leftJoin(tableExpr: string) {
    this.joins.push(`LEFT JOIN ${tableExpr}`);
    return this;
  }

  where(sql: string, ...params: (string | number | null)[]) {
    this.conditions.push({ sql, params });
    return this;
  }

  orderBy(cols: string) {
    this.orderCols = cols;
    return this;
  }

  private cteSql() {
    return this.ctes.length ? `WITH ${this.ctes.map((c) => c.sql).join(', ')} ` : '';
  }

  private joinSql() {
    return this.joins.join(' ');
  }

  private whereSql() {
    const sqls = this.conditions.map((c) => c.sql);
    return sqls.length ? `WHERE ${sqls.join(' AND ')}` : '';
  }

  dedup(table: string, groupByExpr: string) {
    const subqueryConditions = this.conditions.map((c) => c.sql.replace(/\bc\./g, 'c2.'));
    const subqueryParams = this.conditions.flatMap((c) => c.params);
    const whereSql = subqueryConditions.length ? `WHERE ${subqueryConditions.join(' AND ')}` : '';
    const groupSql = groupByExpr.replace(/\bc\./g, 'c2.');
    const dedupSql = `c.id IN (SELECT MIN(c2.id) FROM ${table} c2 ${whereSql} GROUP BY ${groupSql})`;
    this.conditions.push({ sql: dedupSql, params: subqueryParams });
    return this;
  }

  count(from: string): { sql: string; params: (string | number | null)[] } {
    const sql = `${this.cteSql()}SELECT COUNT(*) as total FROM ${from} ${this.joinSql()} ${this.whereSql()}`.trim();
    return { sql, params: this.allParams() };
  }

  select(cols: string, from: string, limit?: number, offset?: number): { sql: string; params: (string | number | null)[] } {
    let sql = `${this.cteSql()}SELECT ${cols} FROM ${from} ${this.joinSql()} ${this.whereSql()}`.trim();
    sql += ` ORDER BY ${this.orderCols}`;
    const finalParams = [...this.allParams()];
    if (limit !== undefined) { sql += ' LIMIT ?'; finalParams.push(limit); }
    if (offset !== undefined) { sql += ' OFFSET ?'; finalParams.push(offset); }
    return { sql, params: finalParams };
  }
}

function buildCardColumns(preferredLanguage?: 'english' | 'japanese'): string {
  if (preferredLanguage === 'japanese') {
    return `c.id, c.base_id, COALESCE(t.name, c.name), c.rarity, c.category, c.cost, c.power, c.counter,
            COALESCE(t.effect, c.effect), COALESCE(t.trigger_text, c.trigger_text), c.block_number,
            c.colors_json, c.attributes_json, COALESCE(t.types_json, c.types_json)`;
  }
  return `c.id, c.base_id, c.name, c.rarity, c.category, c.cost, c.power, c.counter,
          c.effect, c.trigger_text, c.block_number,
          c.colors_json, c.attributes_json, c.types_json`;
}

function rowToCard(row: (string | number | null)[]): Record<string, unknown> {
  return {
    id: row[0], base_id: row[1], name: row[2], rarity: row[3], category: row[4],
    cost: row[5], power: row[6], counter: row[7],
    effect: row[8], trigger_text: row[9], block_number: row[10],
    colors: parseJsonArray(row[11] as string | null),
    attributes: parseJsonArray(row[12] as string | null),
    types: parseJsonArray(row[13] as string | null),
    has_parallel: false,
  };
}

function queryCards(db: Database, filters: QueryCardsFilters): { cards: unknown[]; total: number } {
  const q = new QueryBuilder();

  if (filters.search) {
    const raw = filters.search.trim();
    const scopes = filters.searchScope;

    if (!scopes || scopes.length === 0) {
      const ftsQuery = raw.split(/\s+/).map((w) => (w.endsWith('*') ? w : `${w}*`)).join(' ');
      q.withCte(
        '_search_ids',
        `SELECT card_id as id FROM cards_fts WHERE search_text MATCH ? UNION SELECT id FROM cards WHERE id LIKE ?`,
        ftsQuery,
        `%${raw}%`
      );
      q.join('_search_ids _s ON c.id = _s.id');
    } else {
      const colClauses: string[] = [];
      const colParams: string[] = [];
      for (const s of scopes) {
        if (s === 'type') {
          colClauses.push(`c.base_id IN (SELECT card_id FROM card_types WHERE type LIKE ?)`);
          colParams.push(`%${raw}%`);
        } else {
          const col = s === 'name' ? 'c.name' : s === 'effect' ? 'c.effect' : 'c.trigger_text';
          colClauses.push(`${col} LIKE ?`);
          colParams.push(`%${raw}%`);
        }
      }
      q.where(`(${colClauses.join(' OR ')})`, ...colParams);
    }
  }

  if (filters.categories?.length) {
    q.where(`c.category IN (${placeholders(filters.categories.length)})`, ...filters.categories);
  }
  if (filters.rarities?.length) {
    q.where(`c.rarity IN (${placeholders(filters.rarities.length)})`, ...filters.rarities);
  }
  if (filters.attributes?.length) {
    q.where(`c.base_id IN (SELECT card_id FROM card_attributes WHERE attribute IN (${placeholders(filters.attributes.length)}))`, ...filters.attributes);
  }
  if (filters.costMin != null) q.where('c.cost >= ?', filters.costMin);
  if (filters.costMax != null) q.where('c.cost <= ?', filters.costMax);
  if (filters.powerMin != null) q.where('c.power >= ?', filters.powerMin);
  if (filters.powerMax != null) q.where('c.power <= ?', filters.powerMax);
  if (filters.counterMin != null) q.where('c.counter >= ?', filters.counterMin);
  if (filters.counterMax != null) q.where('c.counter <= ?', filters.counterMax);
  if (filters.sets?.length) {
    const clauses = filters.sets.map(() => 'c.id LIKE ?').join(' OR ');
    q.where(`(${clauses})`, ...filters.sets.map(s => `${s}-%`));
  }
  if (filters.blockMin != null) q.where('(c.block_number >= ? OR c.block_number IS NULL)', filters.blockMin);
  if (filters.blockMax != null) q.where('(c.block_number <= ? OR c.block_number IS NULL)', filters.blockMax);
  if (filters.colors?.length) {
    q.where(`c.base_id IN (SELECT card_id FROM card_colors WHERE color IN (${placeholders(filters.colors.length)}))`, ...filters.colors);
  }
  if (filters.hideVariants) {
    q.where('c.base_id = c.id');
  }

  // Inline image aggregation (replaces card_best_images table)
  q.leftJoin(`(
    SELECT card_id,
      MAX(CASE WHEN language = 'english' THEN img_full_url END) as img_en,
      MAX(CASE WHEN language = 'english-asia' THEN img_full_url END) as img_ea,
      MAX(CASE WHEN language = 'japanese' THEN img_full_url END) as img_jp
    FROM card_images
    WHERE img_full_url IS NOT NULL AND img_full_url != ''
    GROUP BY card_id
  ) ci ON c.id = ci.card_id`);

  if (filters.preferredLanguage === 'japanese') {
    q.leftJoin("card_translations t ON c.base_id = t.card_id AND t.language = 'japanese'");
  }

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const countQ = q.count('cards c');
  const countRes = db.exec(countQ.sql, countQ.params);
  const total = (countRes[0]?.values[0]?.[0] as number) || 0;

  const dataQ = q.select(buildCardColumns(filters.preferredLanguage) + `, COALESCE(ci.img_en, ci.img_ea, ci.img_jp) as img_url, EXISTS(SELECT 1 FROM cards cv WHERE cv.base_id = c.base_id AND INSTR(cv.id, '_p') > 0) as has_parallel`, 'cards c', limit, offset);
  const dataRes = db.exec(dataQ.sql, dataQ.params);

  const cards: unknown[] = [];
  if (dataRes[0]) {
    for (const row of dataRes[0].values) {
      const card = rowToCard(row);
      (card as Record<string, unknown>).img_url = row[14] || null;
      (card as Record<string, unknown>).has_parallel = !!row[15];
      cards.push(card);
    }
  }

  return { cards, total };
}

function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(',');
}

function queryPacks(db: Database): unknown[] {
  const result = db.exec('SELECT id, language, prefix, title, label, raw_title FROM packs ORDER BY id');
  if (!result[0]) return [];
  return result[0].values.map((row) => ({
    id: row[0], language: row[1], prefix: row[2], title: row[3], label: row[4], raw_title: row[5],
  }));
}

function querySets(db: Database): string[] {
  const result = db.exec("SELECT DISTINCT SUBSTR(id, 1, INSTR(id, '-') - 1) as prefix FROM cards ORDER BY prefix");
  if (!result[0]) return [];
  return result[0].values.map((row) => row[0] as string);
}

function queryBlocks(db: Database): number[] {
  const result = db.exec('SELECT DISTINCT block_number FROM cards WHERE block_number IS NOT NULL ORDER BY block_number');
  if (!result[0]) return [];
  return result[0].values.map((row) => row[0] as number);
}

function getCardById(db: Database, id: string, preferredLanguage?: 'english' | 'japanese'): unknown | null {
  const translationJoin = preferredLanguage === 'japanese'
    ? " LEFT JOIN card_translations t ON cards.base_id = t.card_id AND t.language = 'japanese'"
    : '';
  const cols = preferredLanguage === 'japanese'
    ? `cards.id, cards.base_id, COALESCE(t.name, cards.name), cards.rarity, cards.category, cards.cost, cards.power, cards.counter,
       COALESCE(t.effect, cards.effect), COALESCE(t.trigger_text, cards.trigger_text), cards.block_number,
       cards.colors_json, cards.attributes_json, COALESCE(t.types_json, cards.types_json)`
    : `id, base_id, name, rarity, category, cost, power, counter,
       effect, trigger_text, block_number,
       colors_json, attributes_json, types_json`;

  const result = db.exec(
    `SELECT ${cols}
     FROM cards${translationJoin}
     WHERE UPPER(id) = UPPER(?)`,
    [id]
  );
  if (!result[0]?.values[0]) return null;
  return rowToCard(result[0].values[0]);
}

function getCardPacks(db: Database, cardId: string): unknown[] {
  // Get all variant IDs from cards table via base_id
  const baseIdResult = db.exec(
    `SELECT base_id FROM cards WHERE id = ?`,
    [cardId]
  );
  const baseId = baseIdResult[0]?.values[0]?.[0] as string | null || cardId;

  const result = db.exec(
    `SELECT DISTINCT p.label, MIN(p.raw_title) as raw_title
     FROM card_packs cp
     JOIN packs p ON cp.pack_id = p.id AND cp.language = p.language
     WHERE cp.card_id IN (SELECT id FROM cards WHERE base_id = ?) AND p.label != '' AND p.label IS NOT NULL
     GROUP BY p.label
     ORDER BY p.label`,
    [baseId]
  );
  if (!result[0]) return [];
  return result[0].values.map((row) => ({
    packId: row[0], label: row[0], rawTitle: row[1],
  }));
}

function getCardImages(db: Database, cardId: string): unknown[] {
  const result = db.exec(
    `SELECT language, img_full_url FROM card_images
     WHERE card_id = ? AND img_full_url IS NOT NULL AND img_full_url != ''
        ORDER BY CASE WHEN language = 'english' THEN 0 ELSE 1 END`,
    [cardId]
  );
  if (!result[0]) return [];
  return result[0].values.map((row) => ({ language: row[0], imgUrl: row[1] }));
}

function getCardVariants(db: Database, cardId: string, preferredLanguage?: 'english' | 'japanese'): { variants: unknown[] } {
  const translationJoin = preferredLanguage === 'japanese'
    ? " LEFT JOIN card_translations t ON c.base_id = t.card_id AND t.language = 'japanese'"
    : '';
  const cols = preferredLanguage === 'japanese'
    ? `c.id, c.base_id, COALESCE(t.name, c.name), c.rarity, c.category, c.cost, c.power, c.counter,
       COALESCE(t.effect, c.effect), COALESCE(t.trigger_text, c.trigger_text), c.block_number,
       c.colors_json, c.attributes_json, COALESCE(t.types_json, c.types_json)`
    : `c.id, c.base_id, c.name, c.rarity, c.category, c.cost, c.power, c.counter,
       c.effect, c.trigger_text, c.block_number,
       c.colors_json, c.attributes_json, c.types_json`;

  const baseIdResult = db.exec(
    `SELECT base_id FROM cards WHERE id = ?`,
    [cardId]
  );
  const baseId = baseIdResult[0]?.values[0]?.[0] as string | null || cardId;

  const variantsResult = db.exec(
    `SELECT ${cols}
     FROM cards c${translationJoin}
     WHERE c.base_id = ?
     ORDER BY c.id`,
    [baseId]
  );

  if (!variantsResult[0]) return { variants: [] };

  const variants: unknown[] = [];

  for (const row of variantsResult[0].values) {
    const variantCard = rowToCard(row);

    const imagesResult = db.exec(
      `SELECT language, img_full_url FROM card_images
       WHERE card_id = ? AND img_full_url IS NOT NULL AND img_full_url != ''
       ORDER BY CASE language WHEN 'english' THEN 0 WHEN 'english-asia' THEN 1 WHEN 'japanese' THEN 2 ELSE 3 END`,
      [variantCard.id as string]
    );
    const images = imagesResult[0]
      ? imagesResult[0].values.map((imgRow) => ({ language: imgRow[0] as string, imgUrl: imgRow[1] as string | null }))
      : [];

    const packsResult = db.exec(
      `SELECT DISTINCT p.raw_title, p.language FROM packs p
       JOIN card_packs cp ON p.id = cp.pack_id
       WHERE cp.card_id = ?
       ORDER BY CASE WHEN p.language = 'english' THEN 0 ELSE 1 END, p.id`,
      [variantCard.id as string]
    );
    const packs = packsResult[0]
      ? packsResult[0].values.map((row) => ({ title: row[0] as string, language: row[1] as string }))
      : [];

    variants.push({
      card: variantCard,
      images,
      packs,
    });
  }

  return { variants };
}

function getRelatedCards(db: Database, cardId: string, types: string[], limit: number): unknown[] {
  const q = new QueryBuilder();
  q.where('c.id != ?', cardId);

  if (types.length > 0) {
    const likeConditions = types.map(() => 'c.types_json LIKE ?').join(' OR ');
    q.where(`(${likeConditions})`, ...types.map((t) => `%"${t}"%`));
  }

  const dataQ = q.select(buildCardColumns(), 'cards c', limit, 0);
  const dataRes = db.exec(dataQ.sql, dataQ.params);

  const cards: unknown[] = [];
  if (dataRes[0]) {
    for (const row of dataRes[0].values) {
      cards.push(rowToCard(row));
    }
  }

  return cards;
}

/* ── Worker message handler ───────────────────────────────────── */

self.onmessage = async (e: MessageEvent<{ type: string; id: string; payload?: unknown }>) => {
  const { type, id, payload } = e.data;

  try {
    switch (type) {
      case 'init': {
        const SQL = await initSqlJs({ locateFile: (file: string) => `/${file}` });
        const response = await fetch('/optcg.db', { cache: 'no-store' });
        const buffer = await response.arrayBuffer();
        db = new SQL.Database(new Uint8Array(buffer));

        // Sanity-check: verify the sort_order column exists and report first card
        try {
          const check = db.exec("SELECT id, sort_order FROM cards WHERE base_id = id ORDER BY sort_order, id LIMIT 1");
          if (check[0]?.values[0]) {
            console.log('[DB] First card:', check[0].values[0][0], 'sort_order:', check[0].values[0][1]);
          }
        } catch {
          console.log('[DB] sort_order column not found — old DB loaded');
        }

        self.postMessage({ type: 'init-done', id });
        break;
      }
      case 'queryCards': {
        if (!db) throw new Error('DB not initialized');
        const result = queryCards(db, payload as QueryCardsFilters);
        self.postMessage({ type: 'result', id, data: result });
        break;
      }
      case 'queryPacks': {
        if (!db) throw new Error('DB not initialized');
        const result = queryPacks(db);
        self.postMessage({ type: 'result', id, data: result });
        break;
      }
      case 'querySets': {
        if (!db) throw new Error('DB not initialized');
        const result = querySets(db);
        self.postMessage({ type: 'result', id, data: result });
        break;
      }
      case 'queryBlocks': {
        if (!db) throw new Error('DB not initialized');
        const result = queryBlocks(db);
        self.postMessage({ type: 'result', id, data: result });
        break;
      }
      case 'getCardById': {
        if (!db) throw new Error('DB not initialized');
        const { id: cardId, preferredLanguage } = payload as { id: string; preferredLanguage?: 'english' | 'japanese' };
        const result = getCardById(db, cardId, preferredLanguage);
        self.postMessage({ type: 'result', id, data: result });
        break;
      }
      case 'getCardPacks': {
        if (!db) throw new Error('DB not initialized');
        const { cardId } = payload as { cardId: string };
        const result = getCardPacks(db, cardId);
        self.postMessage({ type: 'result', id, data: result });
        break;
      }
      case 'getCardImages': {
        if (!db) throw new Error('DB not initialized');
        const { cardId } = payload as { cardId: string };
        const result = getCardImages(db, cardId);
        self.postMessage({ type: 'result', id, data: result });
        break;
      }
      case 'getRelatedCards': {
        if (!db) throw new Error('DB not initialized');
        const { cardId: relCardId, types, limit } = payload as { cardId: string; types: string[]; limit?: number };
        const result = getRelatedCards(db, relCardId, types, limit || 8);
        self.postMessage({ type: 'result', id, data: result });
        break;
      }
      case 'getCardVariants': {
        if (!db) throw new Error('DB not initialized');
        const { cardId: variantCardId, preferredLanguage } = payload as { cardId: string; preferredLanguage?: 'english' | 'japanese' };
        const result = getCardVariants(db, variantCardId, preferredLanguage);
        self.postMessage({ type: 'result', id, data: result });
        break;
      }
      default:
        self.postMessage({ type: 'error', id, error: `Unknown message type: ${type}` });
    }
  } catch (err) {
    self.postMessage({ type: 'error', id, error: String(err) });
  }
};