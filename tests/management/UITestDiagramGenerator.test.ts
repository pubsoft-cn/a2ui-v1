/**
 * UITestDiagramGenerator Tests
 */

import { describe, it, expect } from 'vitest';
import { UITestDiagramGenerator } from '../../src/management/UITestDiagramGenerator';
import type { SchemaDocument, RenderNode } from '../../src/types';
import type { DiagramType } from '../../src/management/types';

const createTestSchema = (): SchemaDocument => ({
  version: '1.0.0',
  meta: {
    title: 'Test Page',
    navigationBar: { title: 'Test Nav' },
  },
  root: {
    id: 'root',
    type: 'view',
    props: {},
    children: [
      { id: 'title', type: 'text', props: { content: 'Hello' } },
      { id: 'img', type: 'image', props: { src: 'test.png' } },
      { id: 'btn', type: 'button', props: { text: 'Click' } },
    ],
  },
});

const createTestRenderTree = (): RenderNode => ({
  id: 'root',
  type: 'view',
  props: {},
  children: [
    { id: 'title', type: 'text', props: { content: 'Hello World' } },
    { id: 'img', type: 'image', props: { src: 'test.png' } },
    { id: 'btn', type: 'button', props: { text: 'Submit' } },
  ],
});

describe('UITestDiagramGenerator', () => {
  const generator = new UITestDiagramGenerator();

  describe('generate', () => {
    const diagramTypes: DiagramType[] = [
      'management-design',
      'management-preview',
      'miniprogram-preview',
      'miniprogram-operation',
    ];

    diagramTypes.forEach((type) => {
      it(`should generate ${type} diagram`, () => {
        const result = generator.generate(
          type,
          createTestSchema(),
          createTestRenderTree()
        );

        expect(result.type).toBe(type);
        expect(result.svg).toContain('<svg');
        expect(result.svg).toContain('</svg>');
        expect(result.title).toBeTruthy();
        expect(result.generatedAt).toBeTruthy();
      });
    });

    it('should generate management-design with grid', () => {
      const result = generator.generate(
        'management-design',
        createTestSchema(),
        undefined,
        { showGrid: true }
      );
      expect(result.svg).toContain('line');
    });

    it('should generate without schema (placeholder mode)', () => {
      const result = generator.generate('management-design');
      expect(result.svg).toContain('<svg');
      expect(result.svg).toContain('拖拽组件到此处');
    });

    it('should generate miniprogram preview without render tree', () => {
      const result = generator.generate('miniprogram-preview');
      expect(result.svg).toContain('<svg');
      expect(result.svg).toContain('搜索商品');
    });

    it('should generate miniprogram operation diagram', () => {
      const result = generator.generate('miniprogram-operation');
      expect(result.svg).toContain('商品详情');
      expect(result.svg).toContain('加入购物车');
      expect(result.svg).toContain('立即购买');
    });
  });

  describe('generateAll', () => {
    it('should generate all 4 diagram types', () => {
      const results = generator.generateAll(
        createTestSchema(),
        createTestRenderTree()
      );

      expect(results).toHaveLength(4);
      expect(results.map((r) => r.type)).toEqual([
        'management-design',
        'management-preview',
        'miniprogram-preview',
        'miniprogram-operation',
      ]);
    });

    it('should generate valid SVGs for all types', () => {
      const results = generator.generateAll();
      for (const result of results) {
        expect(result.svg).toContain('<svg');
        expect(result.svg).toContain('</svg>');
      }
    });
  });

  describe('SVG content validation', () => {
    it('should include Chinese labels in management design', () => {
      const result = generator.generate('management-design');
      expect(result.svg).toContain('组件面板');
      expect(result.svg).toContain('属性面板');
      expect(result.svg).toContain('设计画布');
    });

    it('should include phone frame in miniprogram preview', () => {
      const result = generator.generate('miniprogram-preview');
      expect(result.svg).toContain('小程序预览');
      expect(result.svg).toContain('首页');
    });

    it('should include management preview with data panel', () => {
      const result = generator.generate('management-preview');
      expect(result.svg).toContain('数据上下文');
      expect(result.svg).toContain('预览模式');
    });

    it('should include operation actions', () => {
      const result = generator.generate('miniprogram-operation');
      expect(result.svg).toContain('收藏');
      expect(result.svg).toContain('咨询');
    });
  });
});
