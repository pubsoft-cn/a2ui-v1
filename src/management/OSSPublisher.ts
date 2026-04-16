/**
 * OSSPublisher - Publish Schemas to Object Storage
 *
 * Manages the publishing workflow: validate, version, upload to OSS,
 * and track published versions.
 */

import type { SchemaDocument } from '../types';
import type {
  OSSConfig,
  OSSUploadAdapter,
  OSSUploadResult,
  PublishOptions,
  PublishResult,
} from './types';

export class OSSPublisher {
  private config: OSSConfig;
  private adapter: OSSUploadAdapter;

  constructor(config: OSSConfig, adapter?: OSSUploadAdapter) {
    this.config = config;
    this.adapter = adapter ?? config.customUpload ?? createInMemoryAdapter();
  }

  /**
   * Publish a schema document to OSS.
   */
  async publish(
    schemaId: string,
    schema: SchemaDocument,
    options?: PublishOptions
  ): Promise<PublishResult> {
    const errors: string[] = [];

    try {
      // 1. Validate schema
      if (!schema.version || !schema.root) {
        errors.push('Invalid schema: missing version or root');
        return {
          success: false,
          url: '',
          version: '',
          schemaId,
          publishedAt: new Date().toISOString(),
          errors,
        };
      }

      // 2. Generate version
      const version =
        options?.version ?? this.generateVersionHash(schema);

      // 3. Serialize schema
      const content = JSON.stringify(schema, null, 2);

      // 4. Build OSS key
      const key = this.buildOSSKey(schemaId, version);

      // 5. Upload versioned schema
      const uploadResult = await this.adapter.upload(
        key,
        content,
        'application/json'
      );

      // 6. Optionally set as latest
      if (options?.setLatest !== false) {
        const latestKey = this.buildOSSKey(schemaId, 'latest');
        await this.adapter.upload(
          latestKey,
          content,
          'application/json'
        );
      }

      // 7. Build CDN URL
      const cdnUrl = this.buildCDNUrl(schemaId, version);

      return {
        success: true,
        url: cdnUrl,
        version,
        schemaId,
        publishedAt: new Date().toISOString(),
      };
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : String(error)
      );
      return {
        success: false,
        url: '',
        version: '',
        schemaId,
        publishedAt: new Date().toISOString(),
        errors,
      };
    }
  }

  /**
   * Unpublish a specific version.
   */
  async unpublish(schemaId: string, version: string): Promise<boolean> {
    try {
      const key = this.buildOSSKey(schemaId, version);
      await this.adapter.delete(key);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a schema version exists in OSS.
   */
  async exists(schemaId: string, version: string): Promise<boolean> {
    const key = this.buildOSSKey(schemaId, version);
    return this.adapter.exists(key);
  }

  /**
   * Get the CDN URL for a published schema.
   */
  getCDNUrl(schemaId: string, version?: string): string {
    return this.buildCDNUrl(schemaId, version ?? 'latest');
  }

  /**
   * Build the OSS object key.
   */
  private buildOSSKey(schemaId: string, version: string): string {
    const base = this.config.basePath.replace(/\/+$/, '');
    return `${base}/schemas/${encodeURIComponent(schemaId)}/${encodeURIComponent(version)}.json`;
  }

  /**
   * Build the CDN URL.
   */
  private buildCDNUrl(schemaId: string, version: string): string {
    const base = this.config.cdnBaseUrl.replace(/\/+$/, '');
    return `${base}/schemas/${encodeURIComponent(schemaId)}/${encodeURIComponent(version)}.json`;
  }

  /**
   * Generate a version hash from schema content.
   */
  private generateVersionHash(schema: SchemaDocument): string {
    const content = JSON.stringify(schema);
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return `v${Math.abs(hash).toString(36)}`;
  }
}

/**
 * Create an in-memory OSS adapter for testing.
 */
export function createInMemoryAdapter(): OSSUploadAdapter {
  const store = new Map<string, { content: string; timestamp: string }>();

  return {
    async upload(
      key: string,
      content: string,
      _contentType: string
    ): Promise<OSSUploadResult> {
      store.set(key, {
        content,
        timestamp: new Date().toISOString(),
      });
      return {
        url: key,
        hash: key,
        timestamp: new Date().toISOString(),
        size: content.length,
      };
    },

    async delete(key: string): Promise<void> {
      store.delete(key);
    },

    async exists(key: string): Promise<boolean> {
      return store.has(key);
    },
  };
}
