import { storageService } from '../storage';
import { normalizeDIDDocument } from './normalize-did-document';

interface CacheEntry {
  value: any;
  id: string;
  timestamp: number;
}

interface CacheOptions {
  ttl?: number;
}

interface DIDResolver {
  resolve(did: string): Promise<any>;
  supports(id: string): boolean;
}

export class CachedDIDResolver {
  private router: DIDResolver;
  private ttl: number;
  private readonly CACHE_PREFIX = 'did-cache:';

  constructor(router: DIDResolver, cacheOptions: CacheOptions = {}) {
    this.router = router;
    // 1 hour default
    this.ttl = cacheOptions.ttl || 60 * 60 * 1000;
  }

  private getCacheKey(did: string): string {
    return `${this.CACHE_PREFIX}${did}`;
  }
  

  private async getCacheEntry(did: string): Promise<CacheEntry | null> {
    const key = this.getCacheKey(did);
    const data = await storageService.getItem(key);

    try {
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error parsing cache entry:', error);
      return null;
    }
  }

  private async setCacheEntry(did: string, entry: CacheEntry): Promise<void> {
    const key = this.getCacheKey(did);
    await storageService.setItem(key, JSON.stringify(entry));
  }

  async getCachedDIDs(): Promise<string[]> {
    const allKeys = await storageService.getAllKeys();
    const cachedDIDs: string[] = [];
    
    allKeys.forEach(key => {
      if (key.startsWith(this.CACHE_PREFIX)) {
        cachedDIDs.push(key.replace(this.CACHE_PREFIX, ''));
      }
    });
    
    return cachedDIDs;
  }

  async resolve(did: string): Promise<any> {
    const cached = await this.getCacheEntry(did);

    if (cached) {
      if (Date.now() - cached.timestamp < this.ttl) {
        console.log('Cache hit for:', did);
        return cached.value;
      } else {
        console.log('Cache expired for:', did, 'returning stale value and refreshing in background');
        this.refreshInBackground(did);
        return cached.value;
      }
    }

    console.log('Cache miss, resolving:', did);
    const result = normalizeDIDDocument(await this.router.resolve(did));

    await this.setCacheEntry(result.id, {
      value: result,
      id: result.id,
      timestamp: Date.now()
    });

    return result;
  }

  private async refreshInBackground(did: string): Promise<void> {
    try {
      console.log('Refreshing cache in background for:', did);
      const result = normalizeDIDDocument(await this.router.resolve(did));

      await this.setCacheEntry(did, {
        value: result,
        id: did,
        timestamp: Date.now()
      });

      console.log('Background refresh completed for:', did);
    } catch (error) {
      console.warn('Background refresh failed for:', did, error);
    }
  }

  /**
   * if the did is provided, it will remove the specific did from the cache
   * otherwise, it will clear the entire cache
   * @param did
   */
  async clearCache(did?: string): Promise<void> {
    if (did) {
      const key = this.getCacheKey(did);
      await storageService.removeItem(key);
    } else {
      const allKeys = await storageService.getAllKeys();
      const cacheKeys = allKeys.filter(key => key.startsWith(this.CACHE_PREFIX));
      await Promise.all(cacheKeys.map(key => storageService.removeItem(key)));
    }
  }

  supports(id: string): boolean {
    return this.router.supports(id);
  }
}