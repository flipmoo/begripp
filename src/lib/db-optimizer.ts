/**
 * Database Optimizer
 * 
 * Utilities voor het optimaliseren van database queries en performance.
 */
import { Database } from 'sqlite';

/**
 * Interface voor query statistieken
 */
interface QueryStats {
  /** Query tekst */
  query: string;
  /** Aantal keer uitgevoerd */
  count: number;
  /** Totale uitvoeringstijd in ms */
  totalTime: number;
  /** Gemiddelde uitvoeringstijd in ms */
  avgTime: number;
  /** Minimale uitvoeringstijd in ms */
  minTime: number;
  /** Maximale uitvoeringstijd in ms */
  maxTime: number;
  /** Laatste uitvoeringstijd in ms */
  lastTime: number;
  /** Laatste uitvoeringstijd */
  lastExecuted: Date;
}

/**
 * Klasse voor het optimaliseren van database queries
 */
export class DbOptimizer {
  private queryStats: Map<string, QueryStats> = new Map();
  private slowQueryThreshold: number = 100; // ms
  private db: Database | null = null;
  private indexesCreated: Set<string> = new Set();

  /**
   * Initialiseer de optimizer met een database connectie
   * @param db Database connectie
   */
  initialize(db: Database): void {
    this.db = db;
    console.log('Database optimizer initialized');
  }

  /**
   * Meet de uitvoeringstijd van een query
   * @param query Query tekst
   * @param params Query parameters
   * @param fn Functie die de query uitvoert
   * @returns Resultaat van de query
   */
  async measureQuery<T>(query: string, params: any[], fn: () => Promise<T>): Promise<T> {
    // Normaliseer de query (verwijder whitespace en parameters)
    const normalizedQuery = this.normalizeQuery(query);
    
    // Meet de uitvoeringstijd
    const startTime = performance.now();
    try {
      const result = await fn();
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Update statistieken
      this.updateQueryStats(normalizedQuery, executionTime);
      
      // Log trage queries
      if (executionTime > this.slowQueryThreshold) {
        console.warn(`Slow query detected (${executionTime.toFixed(2)}ms): ${normalizedQuery}`);
        
        // Suggereer optimalisaties voor trage queries
        this.suggestOptimizations(normalizedQuery, params);
      }
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      console.error(`Query error (${executionTime.toFixed(2)}ms): ${normalizedQuery}`, error);
      throw error;
    }
  }

  /**
   * Voer een geoptimaliseerde query uit
   * @param db Database connectie
   * @param query Query tekst
   * @param params Query parameters
   * @returns Resultaat van de query
   */
  async query<T>(query: string, params: any[] = []): Promise<T[]> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    return this.measureQuery(query, params, () => this.db!.all<T[]>(query, params));
  }

  /**
   * Voer een geoptimaliseerde query uit die één resultaat retourneert
   * @param db Database connectie
   * @param query Query tekst
   * @param params Query parameters
   * @returns Resultaat van de query
   */
  async queryOne<T>(query: string, params: any[] = []): Promise<T | undefined> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    return this.measureQuery(query, params, () => this.db!.get<T>(query, params));
  }

  /**
   * Voer een geoptimaliseerde query uit die geen resultaat retourneert
   * @param db Database connectie
   * @param query Query tekst
   * @param params Query parameters
   */
  async execute(query: string, params: any[] = []): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    await this.measureQuery(query, params, () => this.db!.run(query, params));
  }

  /**
   * Analyseer de database en maak indexen aan voor veelgebruikte queries
   */
  async analyzeAndOptimize(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    
    console.log('Analyzing database for optimization opportunities...');
    
    try {
      // Voer ANALYZE uit om statistieken te verzamelen
      await this.db.run('ANALYZE');
      
      // Controleer of er indexen nodig zijn op basis van query statistieken
      const slowQueries = Array.from(this.queryStats.values())
        .filter(stats => stats.avgTime > this.slowQueryThreshold)
        .sort((a, b) => b.avgTime - a.avgTime);
      
      console.log(`Found ${slowQueries.length} slow queries to optimize`);
      
      for (const stats of slowQueries) {
        await this.optimizeQuery(stats.query);
      }
      
      // Voer VACUUM uit om de database te optimaliseren
      console.log('Running VACUUM to optimize database...');
      await this.db.run('VACUUM');
      
      console.log('Database optimization completed');
    } catch (error) {
      console.error('Error during database optimization:', error);
    }
  }

  /**
   * Optimaliseer een specifieke query
   * @param query Query tekst
   */
  private async optimizeQuery(query: string): Promise<void> {
    if (!this.db) {
      return;
    }
    
    try {
      // Analyseer de query om te bepalen welke indexen nodig zijn
      const tables = this.extractTablesFromQuery(query);
      const whereColumns = this.extractWhereColumnsFromQuery(query);
      const orderByColumns = this.extractOrderByColumnsFromQuery(query);
      const joinColumns = this.extractJoinColumnsFromQuery(query);
      
      // Maak indexen aan voor WHERE clausules
      for (const table of tables) {
        for (const column of whereColumns) {
          if (column.includes('.')) {
            const [tableAlias, columnName] = column.split('.');
            const actualTable = this.resolveTableAlias(tableAlias, query) || table;
            await this.createIndexIfNeeded(actualTable, columnName);
          } else {
            await this.createIndexIfNeeded(table, column);
          }
        }
        
        // Maak indexen aan voor ORDER BY clausules
        for (const column of orderByColumns) {
          if (column.includes('.')) {
            const [tableAlias, columnName] = column.split('.');
            const actualTable = this.resolveTableAlias(tableAlias, query) || table;
            await this.createIndexIfNeeded(actualTable, columnName);
          } else {
            await this.createIndexIfNeeded(table, column);
          }
        }
        
        // Maak indexen aan voor JOIN clausules
        for (const column of joinColumns) {
          if (column.includes('.')) {
            const [tableAlias, columnName] = column.split('.');
            const actualTable = this.resolveTableAlias(tableAlias, query) || table;
            await this.createIndexIfNeeded(actualTable, columnName);
          } else {
            await this.createIndexIfNeeded(table, column);
          }
        }
      }
    } catch (error) {
      console.error(`Error optimizing query: ${query}`, error);
    }
  }

  /**
   * Maak een index aan als deze nog niet bestaat
   * @param table Tabel naam
   * @param column Kolom naam
   */
  private async createIndexIfNeeded(table: string, column: string): Promise<void> {
    if (!this.db) {
      return;
    }
    
    // Skip als de kolom leeg is of een speciale waarde
    if (!column || column === '*' || column.includes('(')) {
      return;
    }
    
    const indexName = `idx_${table}_${column}`;
    
    // Skip als de index al is aangemaakt in deze sessie
    if (this.indexesCreated.has(indexName)) {
      return;
    }
    
    try {
      // Controleer of de index al bestaat
      const indexExists = await this.db.get(`
        SELECT name FROM sqlite_master 
        WHERE type='index' AND name=?
      `, [indexName]);
      
      if (!indexExists) {
        console.log(`Creating index ${indexName} on ${table}(${column})...`);
        
        // Maak de index aan
        await this.db.run(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${table}(${column})`);
        
        // Markeer de index als aangemaakt
        this.indexesCreated.add(indexName);
        
        console.log(`Index ${indexName} created successfully`);
      }
    } catch (error) {
      console.error(`Error creating index ${indexName}:`, error);
    }
  }

  /**
   * Normaliseer een query voor consistente statistieken
   * @param query Query tekst
   * @returns Genormaliseerde query
   */
  private normalizeQuery(query: string): string {
    return query
      .replace(/\s+/g, ' ')
      .replace(/\s*=\s*/g, '=')
      .replace(/\s*,\s*/g, ',')
      .replace(/\s*\(\s*/g, '(')
      .replace(/\s*\)\s*/g, ')')
      .trim();
  }

  /**
   * Update query statistieken
   * @param query Query tekst
   * @param executionTime Uitvoeringstijd in ms
   */
  private updateQueryStats(query: string, executionTime: number): void {
    const stats = this.queryStats.get(query) || {
      query,
      count: 0,
      totalTime: 0,
      avgTime: 0,
      minTime: Infinity,
      maxTime: 0,
      lastTime: 0,
      lastExecuted: new Date()
    };
    
    stats.count++;
    stats.totalTime += executionTime;
    stats.avgTime = stats.totalTime / stats.count;
    stats.minTime = Math.min(stats.minTime, executionTime);
    stats.maxTime = Math.max(stats.maxTime, executionTime);
    stats.lastTime = executionTime;
    stats.lastExecuted = new Date();
    
    this.queryStats.set(query, stats);
  }

  /**
   * Suggereer optimalisaties voor een query
   * @param query Query tekst
   * @param params Query parameters
   */
  private suggestOptimizations(query: string, params: any[]): void {
    // Controleer op ontbrekende WHERE clausule
    if (!query.toLowerCase().includes('where') && query.toLowerCase().includes('select')) {
      console.warn('Optimization suggestion: Add WHERE clause to limit results');
    }
    
    // Controleer op ontbrekende indexen
    const tables = this.extractTablesFromQuery(query);
    const whereColumns = this.extractWhereColumnsFromQuery(query);
    
    if (tables.length > 0 && whereColumns.length > 0) {
      console.log('Optimization suggestion: Consider adding indexes for:', whereColumns.join(', '));
    }
    
    // Controleer op gebruik van LIKE met wildcard aan het begin
    if (query.toLowerCase().includes('like') && params.some(p => typeof p === 'string' && p.startsWith('%'))) {
      console.warn('Optimization suggestion: LIKE with leading wildcard cannot use indexes efficiently');
    }
    
    // Controleer op gebruik van functies in WHERE clausule
    if (query.toLowerCase().includes('where') && 
        /where.*\w+\s*\(/.test(query.toLowerCase())) {
      console.warn('Optimization suggestion: Functions in WHERE clause cannot use indexes efficiently');
    }
  }

  /**
   * Extraheer tabellen uit een query
   * @param query Query tekst
   * @returns Array van tabelnamen
   */
  private extractTablesFromQuery(query: string): string[] {
    const tables: string[] = [];
    const fromMatch = query.match(/from\s+([a-z0-9_]+)/i);
    
    if (fromMatch && fromMatch[1]) {
      tables.push(fromMatch[1]);
    }
    
    // Zoek ook naar JOIN clausules
    const joinRegex = /join\s+([a-z0-9_]+)/gi;
    let joinMatch;
    
    while ((joinMatch = joinRegex.exec(query)) !== null) {
      if (joinMatch[1]) {
        tables.push(joinMatch[1]);
      }
    }
    
    return tables;
  }

  /**
   * Extraheer WHERE kolommen uit een query
   * @param query Query tekst
   * @returns Array van kolomnamen
   */
  private extractWhereColumnsFromQuery(query: string): string[] {
    const columns: string[] = [];
    const whereClause = query.match(/where\s+(.*?)(?:order by|group by|limit|$)/i);
    
    if (whereClause && whereClause[1]) {
      const conditions = whereClause[1].split(/\s+and\s+|\s+or\s+/i);
      
      for (const condition of conditions) {
        const columnMatch = condition.match(/([a-z0-9_.]+)\s*(?:=|<|>|<=|>=|like|in|is)/i);
        
        if (columnMatch && columnMatch[1]) {
          columns.push(columnMatch[1]);
        }
      }
    }
    
    return columns;
  }

  /**
   * Extraheer ORDER BY kolommen uit een query
   * @param query Query tekst
   * @returns Array van kolomnamen
   */
  private extractOrderByColumnsFromQuery(query: string): string[] {
    const columns: string[] = [];
    const orderByClause = query.match(/order by\s+(.*?)(?:limit|$)/i);
    
    if (orderByClause && orderByClause[1]) {
      const orderColumns = orderByClause[1].split(/\s*,\s*/);
      
      for (const column of orderColumns) {
        const columnName = column.split(/\s+/)[0]; // Verwijder ASC/DESC
        columns.push(columnName);
      }
    }
    
    return columns;
  }

  /**
   * Extraheer JOIN kolommen uit een query
   * @param query Query tekst
   * @returns Array van kolomnamen
   */
  private extractJoinColumnsFromQuery(query: string): string[] {
    const columns: string[] = [];
    const joinClauses = query.match(/join\s+[a-z0-9_]+\s+(?:as\s+[a-z0-9_]+\s+)?on\s+(.*?)(?:where|order by|group by|limit|join|$)/gi);
    
    if (joinClauses) {
      for (const joinClause of joinClauses) {
        const onMatch = joinClause.match(/on\s+(.*?)(?:where|order by|group by|limit|join|$)/i);
        
        if (onMatch && onMatch[1]) {
          const conditions = onMatch[1].split(/\s+and\s+|\s+or\s+/i);
          
          for (const condition of conditions) {
            const columnMatches = condition.match(/([a-z0-9_.]+)\s*(?:=|<|>|<=|>=)\s*([a-z0-9_.]+)/i);
            
            if (columnMatches && columnMatches[1] && columnMatches[2]) {
              columns.push(columnMatches[1]);
              columns.push(columnMatches[2]);
            }
          }
        }
      }
    }
    
    return columns;
  }

  /**
   * Zoek de echte tabelnaam voor een alias
   * @param alias Tabel alias
   * @param query Query tekst
   * @returns Echte tabelnaam of undefined
   */
  private resolveTableAlias(alias: string, query: string): string | undefined {
    const aliasMatch = query.match(new RegExp(`from\\s+([a-z0-9_]+)\\s+(?:as\\s+)?${alias}\\b|join\\s+([a-z0-9_]+)\\s+(?:as\\s+)?${alias}\\b`, 'i'));
    
    if (aliasMatch) {
      return aliasMatch[1] || aliasMatch[2];
    }
    
    return undefined;
  }

  /**
   * Haal query statistieken op
   * @returns Array van query statistieken
   */
  getQueryStats(): QueryStats[] {
    return Array.from(this.queryStats.values());
  }

  /**
   * Haal trage queries op
   * @param threshold Drempelwaarde in ms (standaard: slowQueryThreshold)
   * @returns Array van trage query statistieken
   */
  getSlowQueries(threshold: number = this.slowQueryThreshold): QueryStats[] {
    return Array.from(this.queryStats.values())
      .filter(stats => stats.avgTime > threshold)
      .sort((a, b) => b.avgTime - a.avgTime);
  }

  /**
   * Stel de drempelwaarde voor trage queries in
   * @param threshold Drempelwaarde in ms
   */
  setSlowQueryThreshold(threshold: number): void {
    this.slowQueryThreshold = threshold;
  }
}

// Singleton instance
export const dbOptimizer = new DbOptimizer();
