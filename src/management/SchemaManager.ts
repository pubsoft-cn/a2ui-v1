/**
 * SchemaManager - Core CRUD management for SchemaDocuments
 *
 * Provides create, read, update, delete operations with version tracking
 * and lifecycle status management.
 */

import type { SchemaDocument } from '../types';
import type {
  ManagedSchema,
  SchemaStatus,
  SchemaVersionRecord,
} from './types';

export class SchemaManager {
  private schemas: Map<string, ManagedSchema> = new Map();

  /**
   * Create a new managed schema.
   */
  create(
    id: string,
    name: string,
    schema: SchemaDocument,
    options?: { description?: string; author?: string; tags?: string[] }
  ): ManagedSchema {
    if (this.schemas.has(id)) {
      throw new Error(`SchemaManager: Schema "${id}" already exists`);
    }

    const now = new Date().toISOString();
    const managed: ManagedSchema = {
      id,
      name,
      description: options?.description,
      status: 'draft',
      schema,
      createdAt: now,
      updatedAt: now,
      author: options?.author,
      tags: options?.tags,
      versions: [],
    };

    this.schemas.set(id, managed);
    return managed;
  }

  /**
   * Get a managed schema by ID.
   */
  get(id: string): ManagedSchema | undefined {
    return this.schemas.get(id);
  }

  /**
   * List all managed schemas with optional filtering.
   */
  list(filter?: {
    status?: SchemaStatus;
    tags?: string[];
    author?: string;
  }): ManagedSchema[] {
    let results = Array.from(this.schemas.values());

    if (filter?.status) {
      results = results.filter((s) => s.status === filter.status);
    }

    if (filter?.tags && filter.tags.length > 0) {
      results = results.filter(
        (s) =>
          s.tags && filter.tags!.some((t) => s.tags!.includes(t))
      );
    }

    if (filter?.author) {
      results = results.filter((s) => s.author === filter.author);
    }

    return results;
  }

  /**
   * Update a managed schema's document.
   */
  updateSchema(id: string, schema: SchemaDocument): ManagedSchema {
    const managed = this.schemas.get(id);
    if (!managed) {
      throw new Error(`SchemaManager: Schema "${id}" not found`);
    }

    managed.schema = schema;
    managed.updatedAt = new Date().toISOString();
    return managed;
  }

  /**
   * Update schema metadata (name, description, tags).
   */
  updateMetadata(
    id: string,
    metadata: { name?: string; description?: string; tags?: string[] }
  ): ManagedSchema {
    const managed = this.schemas.get(id);
    if (!managed) {
      throw new Error(`SchemaManager: Schema "${id}" not found`);
    }

    if (metadata.name !== undefined) managed.name = metadata.name;
    if (metadata.description !== undefined)
      managed.description = metadata.description;
    if (metadata.tags !== undefined) managed.tags = metadata.tags;
    managed.updatedAt = new Date().toISOString();

    return managed;
  }

  /**
   * Transition schema to a new lifecycle status.
   */
  setStatus(id: string, status: SchemaStatus): ManagedSchema {
    const managed = this.schemas.get(id);
    if (!managed) {
      throw new Error(`SchemaManager: Schema "${id}" not found`);
    }

    this.validateStatusTransition(managed.status, status);
    managed.status = status;
    managed.updatedAt = new Date().toISOString();

    return managed;
  }

  /**
   * Add a version record (typically after publishing).
   */
  addVersionRecord(id: string, record: SchemaVersionRecord): void {
    const managed = this.schemas.get(id);
    if (!managed) {
      throw new Error(`SchemaManager: Schema "${id}" not found`);
    }

    managed.versions.push(record);
    managed.updatedAt = new Date().toISOString();
  }

  /**
   * Delete a managed schema.
   */
  delete(id: string): boolean {
    const managed = this.schemas.get(id);
    if (!managed) return false;

    if (managed.status === 'published') {
      throw new Error(
        `SchemaManager: Cannot delete published schema "${id}". Archive it first.`
      );
    }

    return this.schemas.delete(id);
  }

  /**
   * Clone a schema with a new ID.
   */
  clone(sourceId: string, newId: string, newName: string): ManagedSchema {
    const source = this.schemas.get(sourceId);
    if (!source) {
      throw new Error(`SchemaManager: Source schema "${sourceId}" not found`);
    }

    const clonedSchema: SchemaDocument = JSON.parse(
      JSON.stringify(source.schema)
    );

    return this.create(newId, newName, clonedSchema, {
      description: `Cloned from ${source.name}`,
      author: source.author,
      tags: source.tags ? [...source.tags] : undefined,
    });
  }

  /**
   * Get the total count of schemas.
   */
  count(): number {
    return this.schemas.size;
  }

  /**
   * Validate status transitions follow the proper lifecycle.
   */
  private validateStatusTransition(
    current: SchemaStatus,
    next: SchemaStatus
  ): void {
    const validTransitions: Record<SchemaStatus, SchemaStatus[]> = {
      draft: ['testing', 'archived'],
      testing: ['preview', 'draft', 'archived'],
      preview: ['published', 'testing', 'draft', 'archived'],
      published: ['archived'],
      archived: ['draft'],
    };

    const allowed = validTransitions[current];
    if (!allowed || !allowed.includes(next)) {
      throw new Error(
        `SchemaManager: Invalid status transition from "${current}" to "${next}"`
      );
    }
  }
}
