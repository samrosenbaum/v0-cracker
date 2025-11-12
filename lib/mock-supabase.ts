import { getStorageObject, getTable, insertIntoTable, updateTable, deleteFromTable } from './demo-data';

type PostgrestError = {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

type QueryResult<T> = Promise<{ data: T[] | null; error: PostgrestError | null; count?: number | null }>;

type SingleResult<T> = Promise<{ data: T | null; error: PostgrestError | null }>;

const DEFAULT_ERROR: PostgrestError = {
  message: 'Supabase is not configured. Using local demo dataset instead.',
  code: 'MOCK',
  details: null,
  hint: 'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to connect to a real database.',
};

function cloneRow<T extends Record<string, any>>(row: T): T {
  return JSON.parse(JSON.stringify(row));
}

class MockQueryBuilder<T extends Record<string, any>> {
  private filters: ((row: T) => boolean)[] = [];
  private orderBys: { column: string; ascending: boolean }[] = [];
  private pendingRows: T[] | null;
  private rangeArgs: { from: number; to?: number } | null = null;
  private selectedColumns: string = '*';
  private selectOptions?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean };

  constructor(private tableName: string, pendingRows: T[] | null = null) {
    this.pendingRows = pendingRows;
  }

  private applyFilters(rows: T[]): T[] {
    if (!this.filters.length) return rows;
    return rows.filter((row) => this.filters.every((fn) => fn(row)));
  }

  private applyOrder(rows: T[]): T[] {
    if (!this.orderBys.length) return rows;
    return [...rows].sort((a, b) => {
      for (const { column, ascending } of this.orderBys) {
        const aValue = (a as any)[column];
        const bValue = (b as any)[column];
        if (aValue === bValue) continue;
        if (aValue === undefined) return ascending ? 1 : -1;
        if (bValue === undefined) return ascending ? -1 : 1;
        if (aValue > bValue) return ascending ? 1 : -1;
        if (aValue < bValue) return ascending ? -1 : 1;
      }
      return 0;
    });
  }

  private applyRange(rows: T[]): T[] {
    if (!this.rangeArgs) return rows;
    const { from, to } = this.rangeArgs;
    return rows.slice(from, to !== undefined ? to + 1 : undefined);
  }

  private pickColumns(row: T, columns: string): T {
    if (columns === '*' || !columns) return cloneRow(row);
    const columnList = columns.split(',').map((column) => column.trim()).filter(Boolean);
    const picked: Record<string, any> = {};
    columnList.forEach((column) => {
      if (column in row) {
        picked[column] = cloneRow((row as any)[column]);
      }
    });
    return picked as T;
  }

  eq(column: string, value: any) {
    this.filters.push((row) => (row as any)[column] === value);
    return this;
  }

  ilike(column: string, pattern: string) {
    const normalizedPattern = pattern.replace(/%/g, '.*');
    const regex = new RegExp(`^${normalizedPattern}$`, 'i');
    this.filters.push((row) => {
      const value = (row as any)[column];
      if (typeof value !== 'string') return false;
      return regex.test(value);
    });
    return this;
  }

  in(column: string, values: any[]) {
    const set = new Set(values);
    this.filters.push((row) => set.has((row as any)[column]));
    return this;
  }

  not(column: string, operator: string, value: any) {
    if (operator === 'is' && value === null) {
      this.filters.push((row) => (row as any)[column] !== null && (row as any)[column] !== undefined);
    }
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orderBys.push({ column, ascending: options.ascending !== false });
    return this;
  }

  limit(count: number) {
    this.rangeArgs = { from: 0, to: count - 1 };
    return this;
  }

  range(from: number, to: number) {
    this.rangeArgs = { from, to };
    return this;
  }

  select(columns: string = '*', options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }): this {
    this.selectedColumns = columns;
    this.selectOptions = options;
    return this;
  }

  private resetSelection() {
    this.selectedColumns = '*';
    this.selectOptions = undefined;
  }

  private async executeSelect(
    columns: string = this.selectedColumns,
    options: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean } | undefined = this.selectOptions,
  ): QueryResult<T> {
    const rows = this.pendingRows ? [...this.pendingRows] : cloneRow(getTable<T>(this.tableName));
    const filtered = this.pendingRows ? rows : this.applyFilters(rows);
    const ordered = this.applyOrder(filtered);
    const ranged = this.applyRange(ordered);

    const count = options?.count ? filtered.length : null;

    if (options?.head) {
      this.resetSelection();
      this.filters = [];
      this.orderBys = [];
      this.rangeArgs = null;
      this.pendingRows = null;
      return { data: [], error: null, count };
    }

    const data = ranged.map((row) => this.pickColumns(row, columns));
    this.resetSelection();
    this.filters = [];
    this.orderBys = [];
    this.rangeArgs = null;
    this.pendingRows = null;
    return { data, error: null, count };
  }

  async single(columns: string = '*'): SingleResult<T> {
    const { data, error } = await this.executeSelect(columns, this.selectOptions);
    if (error) return { data: null, error };
    if (!data || data.length === 0) {
      return {
        data: null,
        error: {
          ...DEFAULT_ERROR,
          message: `No rows found in local dataset for table ${this.tableName}.`,
          code: 'PGRST116',
        },
      };
    }
    return { data: data[0], error: null };
  }

  async maybeSingle(columns: string = '*'): SingleResult<T> {
    const { data, error } = await this.executeSelect(columns, this.selectOptions);
    if (error) return { data: null, error };
    return { data: data && data.length ? data[0] : null, error: null };
  }

  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: (value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>,
    onrejected?: (reason: any) => TResult2 | PromiseLike<TResult2>,
  ) {
    return this.executeSelect(this.selectedColumns, this.selectOptions).then(onfulfilled, onrejected);
  }

  insert(values: Partial<T> | Partial<T>[]) {
    const inserted = insertIntoTable<T>(this.tableName, values as any);
    return new MockQueryBuilder<T>(this.tableName, inserted as any);
  }

  update(values: Partial<T>) {
    const updated = updateTable<T>(this.tableName, (row) => this.filters.every((fn) => fn(row)), values as any);
    return new MockQueryBuilder<T>(this.tableName, updated as any);
  }

  delete() {
    const deleted = deleteFromTable<T>(this.tableName, (row) => this.filters.every((fn) => fn(row)));
    return new MockQueryBuilder<T>(this.tableName, deleted as any);
  }
}

export function createMockSupabaseClient() {
  return {
    from<T extends Record<string, any>>(tableName: string) {
      return new MockQueryBuilder<T>(tableName);
    },
    storage: {
      from(bucket: string) {
        return {
          async download(path: string) {
            const object = getStorageObject(bucket, path);
            if (!object) {
              return {
                data: null,
                error: {
                  ...DEFAULT_ERROR,
                  message: `No stored object found for ${bucket}/${path} in demo dataset.`,
                },
              };
            }
            const buffer = Buffer.from(object.content, 'utf-8');
            return {
              data: {
                async arrayBuffer() {
                  return buffer;
                },
              },
              error: null,
            };
          },
        };
      },
    },
    auth: {
      async getUser() {
        return { data: { user: { id: 'demo-user', email: 'detective@fresh-eyes.local' } }, error: null };
      },
      async getSession() {
        return { data: { session: null }, error: null };
      },
      onAuthStateChange(callback: any) {
        const subscription = {
          unsubscribe: () => {},
        };
        if (typeof callback === 'function') {
          callback('SIGNED_IN', { user: { id: 'demo-user' } });
        }
        return { data: { subscription }, error: null };
      },
      async signOut() {
        return { error: null };
      },
      async signInWithOtp({ email }: { email: string }) {
        console.warn('[MockSupabase] signInWithOtp called for', email);
        return { data: { user: { id: 'demo-user', email } }, error: null };
      },
    },
  } as any;
}
