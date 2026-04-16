/**
 * SchemaPreviewEngine Tests
 */

import { describe, it, expect } from 'vitest';
import { SchemaPreviewEngine } from '../../src/management/SchemaPreviewEngine';
import type { SchemaDocument, DataContext } from '../../src/types';

const createTestSchema = (): SchemaDocument => ({
  version: '1.0.0',
  meta: { title: 'Test Page', navigationBar: { title: 'Test' } },
  root: {
    id: 'root',
    type: 'view',
    props: {},
    children: [
      { id: 'title', type: 'text', props: { content: '{{data.title}}' } },
      { id: 'subtitle', type: 'text', props: { content: '{{data.subtitle}}' } },
      { id: 'btn', type: 'button', props: { text: 'Click Me' } },
    ],
  },
});

const createTestData = (): DataContext => ({
  data: {
    title: 'Hello World',
    subtitle: 'Welcome to A2UI',
  },
});

describe('SchemaPreviewEngine', () => {
  const engine = new SchemaPreviewEngine();

  describe('preview', () => {
    it('should generate a preview snapshot with data', () => {
      const snapshot = engine.preview(
        createTestSchema(),
        createTestData()
      );

      expect(snapshot.renderTree).toBeDefined();
      expect(snapshot.renderTree.type).toBe('view');
      expect(snapshot.renderTree.children).toHaveLength(3);
      expect(snapshot.dataContext).toBeDefined();
      expect(snapshot.config.mode).toBe('mobile');
      expect(snapshot.timestamp).toBeTruthy();
      expect(snapshot.diagram).toBeTruthy();
    });

    it('should use specified preview config', () => {
      const snapshot = engine.preview(
        createTestSchema(),
        createTestData(),
        { mode: 'desktop', width: 1024, height: 768 }
      );

      expect(snapshot.config.mode).toBe('desktop');
      expect(snapshot.config.width).toBe(1024);
    });

    it('should generate valid SVG in diagram', () => {
      const snapshot = engine.preview(
        createTestSchema(),
        createTestData()
      );

      expect(snapshot.diagram).toContain('<svg');
      expect(snapshot.diagram).toContain('</svg>');
    });

    it('should resolve binding expressions in render tree', () => {
      const snapshot = engine.preview(
        createTestSchema(),
        createTestData()
      );

      const titleNode = snapshot.renderTree.children?.find(
        (c) => c.id === 'title'
      );
      expect(titleNode?.props.content).toBe('Hello World');
    });
  });

  describe('previewStructure', () => {
    it('should preview with empty data and outlines enabled', () => {
      const snapshot = engine.previewStructure(createTestSchema());

      expect(snapshot.config.showOutlines).toBe(true);
      expect(snapshot.config.showBindings).toBe(true);
      expect(snapshot.renderTree).toBeDefined();
    });
  });

  describe('getDefaultConfig', () => {
    it('should return desktop config', () => {
      const config = engine.getDefaultConfig('desktop');
      expect(config.mode).toBe('desktop');
      expect(config.width).toBe(1280);
    });

    it('should return mobile config', () => {
      const config = engine.getDefaultConfig('mobile');
      expect(config.mode).toBe('mobile');
      expect(config.width).toBe(375);
    });

    it('should return miniprogram config', () => {
      const config = engine.getDefaultConfig('miniprogram');
      expect(config.mode).toBe('miniprogram');
      expect(config.width).toBe(375);
      expect(config.height).toBe(667);
    });
  });

  describe('countRenderNodes', () => {
    it('should count all nodes in render tree', () => {
      const snapshot = engine.preview(
        createTestSchema(),
        createTestData()
      );
      const count = engine.countRenderNodes(snapshot.renderTree);
      expect(count).toBe(4); // root + 3 children
    });
  });
});
