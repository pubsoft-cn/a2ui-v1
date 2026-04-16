/**
 * UITestDiagramGenerator - Generate Test UI Diagrams
 *
 * Produces SVG diagrams representing the management platform UI
 * and mini-program UI for testing and documentation purposes.
 */

import type { SchemaDocument, RenderNode } from '../types';
import type { DiagramConfig, DiagramResult, DiagramType } from './types';

/** Default diagram configurations */
const DEFAULT_CONFIGS: Record<DiagramType, DiagramConfig> = {
  'management-design': {
    type: 'management-design',
    width: 1200,
    height: 800,
    title: 'Schema 管理平台 - 设计界面',
    showGrid: true,
    theme: 'light',
  },
  'management-preview': {
    type: 'management-preview',
    width: 1200,
    height: 800,
    title: 'Schema 管理平台 - 预览界面',
    showGrid: false,
    theme: 'light',
  },
  'miniprogram-preview': {
    type: 'miniprogram-preview',
    width: 375,
    height: 812,
    title: '小程序端 - 预览界面',
    showGrid: false,
    theme: 'light',
  },
  'miniprogram-operation': {
    type: 'miniprogram-operation',
    width: 375,
    height: 812,
    title: '小程序端 - 操作界面',
    showGrid: false,
    theme: 'light',
  },
};

export class UITestDiagramGenerator {
  /**
   * Generate a specific type of UI test diagram.
   */
  generate(
    type: DiagramType,
    schema?: SchemaDocument,
    renderTree?: RenderNode,
    configOverride?: Partial<DiagramConfig>
  ): DiagramResult {
    const config = { ...DEFAULT_CONFIGS[type], ...configOverride };

    let svg: string;
    switch (type) {
      case 'management-design':
        svg = this.generateManagementDesign(config, schema);
        break;
      case 'management-preview':
        svg = this.generateManagementPreview(config, schema, renderTree);
        break;
      case 'miniprogram-preview':
        svg = this.generateMiniprogramPreview(config, schema, renderTree);
        break;
      case 'miniprogram-operation':
        svg = this.generateMiniprogramOperation(config, schema, renderTree);
        break;
    }

    return {
      type,
      svg,
      title: config.title,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate all diagram types for a schema.
   */
  generateAll(
    schema?: SchemaDocument,
    renderTree?: RenderNode
  ): DiagramResult[] {
    const types: DiagramType[] = [
      'management-design',
      'management-preview',
      'miniprogram-preview',
      'miniprogram-operation',
    ];

    return types.map((type) =>
      this.generate(type, schema, renderTree)
    );
  }

  /**
   * Management Platform - Design Interface diagram.
   */
  private generateManagementDesign(
    config: DiagramConfig,
    schema?: SchemaDocument
  ): string {
    const w = config.width;
    const h = config.height;

    let svg = this.svgOpen(w, h);

    // Background
    svg += this.rect(0, 0, w, h, '#f5f6fa');

    // Top navigation bar
    svg += this.rect(0, 0, w, 56, '#1a1a2e');
    svg += this.text(20, 36, 'A2UI Schema 管理平台', 18, '#ffffff', 'bold');
    svg += this.text(w - 200, 36, '设计 | 预览 | 测试 | 发布', 12, '#a0a0c0');

    // Left sidebar - Component palette
    const sideW = 240;
    svg += this.rect(0, 56, sideW, h - 56, '#ffffff');
    svg += this.rect(0, 56, sideW, 40, '#f0f0f5');
    svg += this.text(16, 82, '📦 组件面板', 13, '#333', 'bold');

    const components = ['view 容器', 'text 文本', 'image 图片', 'button 按钮', 'input 输入框', 'list 列表', 'scroll-view', 'swiper 轮播', 'form 表单'];
    components.forEach((comp, i) => {
      const y = 110 + i * 36;
      svg += this.rect(12, y, sideW - 24, 30, '#f8f9fa', '#e0e0e0', 4);
      svg += this.text(24, y + 20, comp, 12, '#555');
    });

    // Center - Canvas area
    const canvasX = sideW;
    const canvasW = w - sideW - 300;
    svg += this.rect(canvasX, 56, canvasW, h - 56, '#e8ecf1');
    svg += this.rect(canvasX, 56, canvasW, 36, '#dde1e8');
    svg += this.text(canvasX + 16, 80, '🎨 设计画布', 12, '#666', 'bold');

    // Canvas content - mock schema tree
    if (schema) {
      svg += this.drawSchemaTree(schema.root, canvasX + 40, 120, canvasW - 80);
    } else {
      // Placeholder
      svg += this.rect(canvasX + 40, 110, canvasW - 80, 500, '#ffffff', '#d0d0d0', 8);
      svg += this.text(canvasX + canvasW / 2, 200, '拖拽组件到此处', 16, '#aaa', 'normal', 'middle');

      // Sample components
      svg += this.rect(canvasX + 60, 240, canvasW - 120, 50, '#e3f2fd', '#90caf9', 4);
      svg += this.text(canvasX + 80, 270, '<view> 根容器', 12, '#1565c0');

      svg += this.rect(canvasX + 80, 300, canvasW - 160, 40, '#f3e5f5', '#ce93d8', 4);
      svg += this.text(canvasX + 100, 325, '<text> 标题文本', 12, '#7b1fa2');

      svg += this.rect(canvasX + 80, 350, canvasW - 160, 80, '#e8f5e9', '#a5d6a7', 4);
      svg += this.text(canvasX + 100, 380, '<image> 头图', 12, '#2e7d32');

      svg += this.rect(canvasX + 80, 440, canvasW - 160, 40, '#fff3e0', '#ffcc80', 4);
      svg += this.text(canvasX + 100, 465, '<button> 提交按钮', 12, '#e65100');
    }

    // Grid overlay
    if (config.showGrid) {
      for (let x = canvasX; x < canvasX + canvasW; x += 20) {
        svg += `<line x1="${x}" y1="92" x2="${x}" y2="${h}" stroke="#e0e0e0" stroke-width="0.5" opacity="0.3"/>`;
      }
      for (let y = 92; y < h; y += 20) {
        svg += `<line x1="${canvasX}" y1="${y}" x2="${canvasX + canvasW}" y2="${y}" stroke="#e0e0e0" stroke-width="0.5" opacity="0.3"/>`;
      }
    }

    // Right sidebar - Properties panel
    const propX = w - 300;
    svg += this.rect(propX, 56, 300, h - 56, '#ffffff');
    svg += this.rect(propX, 56, 300, 40, '#f0f0f5');
    svg += this.text(propX + 16, 82, '⚙️ 属性面板', 13, '#333', 'bold');

    // Property fields
    const fields = [
      { label: 'ID', value: 'node_1' },
      { label: '类型', value: 'view' },
      { label: '数据绑定', value: '{{user.name}}' },
      { label: '条件渲染', value: '{{showHeader}}' },
      { label: '样式', value: 'flex: 1, padding: 16' },
    ];
    fields.forEach((field, i) => {
      const y = 110 + i * 60;
      svg += this.text(propX + 16, y + 14, field.label, 11, '#888');
      svg += this.rect(propX + 16, y + 20, 268, 28, '#f5f5f5', '#e0e0e0', 4);
      svg += this.text(propX + 24, y + 39, field.value, 11, '#333');
    });

    // Data Sources section
    svg += this.rect(propX, 430, 300, 40, '#f0f0f5');
    svg += this.text(propX + 16, 456, '📊 数据源配置', 13, '#333', 'bold');

    svg += this.rect(propX + 16, 480, 268, 60, '#f5f5f5', '#e0e0e0', 4);
    svg += this.text(propX + 24, 500, 'GET /api/user', 11, '#1565c0');
    svg += this.text(propX + 24, 520, 'key: userInfo, cache: 60s', 10, '#888');

    // Status bar
    svg += this.rect(0, h - 28, w, 28, '#f0f0f5');
    svg += this.text(16, h - 10, '状态: 设计中 | 节点: 12 | 数据绑定: 5 | 版本: draft', 10, '#888');

    svg += '</svg>';
    return svg;
  }

  /**
   * Management Platform - Preview Interface diagram.
   */
  private generateManagementPreview(
    config: DiagramConfig,
    schema?: SchemaDocument,
    renderTree?: RenderNode
  ): string {
    const w = config.width;
    const h = config.height;

    let svg = this.svgOpen(w, h);

    // Background
    svg += this.rect(0, 0, w, h, '#f5f6fa');

    // Top bar
    svg += this.rect(0, 0, w, 56, '#1a1a2e');
    svg += this.text(20, 36, 'A2UI Schema 管理平台 - 预览', 18, '#ffffff', 'bold');

    // Toolbar
    svg += this.rect(0, 56, w, 44, '#ffffff');
    const buttons = ['💻 桌面', '📱 手机', '📲 小程序', '🔄 刷新', '📋 Mock数据', '🧪 绑定测试'];
    buttons.forEach((btn, i) => {
      const bx = 16 + i * 120;
      svg += this.rect(bx, 64, 110, 28, i === 1 ? '#e3f2fd' : '#f5f5f5', i === 1 ? '#1976d2' : '#e0e0e0', 4);
      svg += this.text(bx + 55, 83, btn, 11, i === 1 ? '#1976d2' : '#666', 'normal', 'middle');
    });

    // Preview area - mobile phone mockup centered
    const phoneW = 375;
    const phoneH = 667;
    const phoneX = (w - phoneW) / 2;
    const phoneY = 120;

    // Phone frame
    svg += this.rect(phoneX - 12, phoneY - 40, phoneW + 24, phoneH + 80, '#1a1a1a', undefined, 30);

    // Status bar
    svg += this.rect(phoneX, phoneY, phoneW, 24, '#f8f8f8', undefined, 0);
    svg += this.text(phoneX + phoneW / 2, phoneY + 16, '9:41', 10, '#333', 'bold', 'middle');

    // Screen content
    svg += this.rect(phoneX, phoneY + 24, phoneW, phoneH - 24, '#ffffff');

    // Navigation bar
    svg += this.rect(phoneX, phoneY + 24, phoneW, 44, '#ffffff');
    svg += this.text(phoneX + phoneW / 2, phoneY + 52, schema?.meta?.title ?? '预览页面', 14, '#333', 'bold', 'middle');

    if (renderTree) {
      // Render the tree nodes
      svg += this.drawRenderTree(renderTree, phoneX + 10, phoneY + 78, phoneW - 20);
    } else {
      // Sample content
      svg += this.rect(phoneX + 12, phoneY + 80, phoneW - 24, 120, '#f0f0f0', '#e0e0e0', 8);
      svg += this.text(phoneX + phoneW / 2, phoneY + 140, '🖼 头图区域', 14, '#999', 'normal', 'middle');

      svg += this.text(phoneX + 16, phoneY + 224, 'Mock 用户名称', 16, '#333', 'bold');
      svg += this.text(phoneX + 16, phoneY + 250, '这是一段模拟的描述文本内容...', 13, '#666');

      // List items
      for (let i = 0; i < 3; i++) {
        const iy = phoneY + 280 + i * 70;
        svg += this.rect(phoneX + 12, iy, phoneW - 24, 60, '#fafafa', '#f0f0f0', 8);
        svg += this.rect(phoneX + 20, iy + 10, 40, 40, '#e3f2fd', '#90caf9', 4);
        svg += this.text(phoneX + 72, iy + 28, `列表项 ${i + 1}`, 13, '#333', 'bold');
        svg += this.text(phoneX + 72, iy + 46, '描述信息文本', 11, '#999');
      }

      // Button
      svg += this.rect(phoneX + 16, phoneY + 510, phoneW - 32, 44, '#1976d2', undefined, 8);
      svg += this.text(phoneX + phoneW / 2, phoneY + 537, '提交按钮', 14, '#ffffff', 'bold', 'middle');
    }

    // Right panel - Data inspector
    const panelX = phoneX + phoneW + 60;
    const panelW = w - panelX - 20;
    if (panelW > 150) {
      svg += this.rect(panelX, 120, panelW, 400, '#ffffff', '#e0e0e0', 8);
      svg += this.rect(panelX, 120, panelW, 36, '#f0f0f5', undefined, 8);
      svg += this.text(panelX + 12, 144, '📊 数据上下文', 12, '#333', 'bold');

      svg += this.text(panelX + 12, 176, '{ "user": {', 10, '#1565c0');
      svg += this.text(panelX + 24, 192, '"name": "张三",', 10, '#c62828');
      svg += this.text(panelX + 24, 208, '"avatar": "https://..."', 10, '#c62828');
      svg += this.text(panelX + 12, 224, '  },', 10, '#1565c0');
      svg += this.text(panelX + 12, 240, '  "items": [ ... ]', 10, '#1565c0');
      svg += this.text(panelX + 12, 256, '}', 10, '#1565c0');
    }

    // Status bar
    svg += this.rect(0, h - 28, w, 28, '#f0f0f5');
    svg += this.text(16, h - 10, '预览模式: 手机(375×667) | 数据源: Mock | 节点: 8 | 绑定: 5/5 已解析', 10, '#888');

    svg += '</svg>';
    return svg;
  }

  /**
   * Mini-program - Preview Interface diagram.
   */
  private generateMiniprogramPreview(
    config: DiagramConfig,
    schema?: SchemaDocument,
    renderTree?: RenderNode
  ): string {
    const w = config.width;
    const h = config.height;

    let svg = this.svgOpen(w + 40, h + 60);

    // Phone frame
    svg += this.rect(8, 8, w + 24, h + 44, '#1a1a1a', undefined, 30);

    // Screen
    const sx = 20;
    const sy = 30;
    svg += this.rect(sx, sy, w, h, '#ffffff');

    // WeChat status bar
    svg += this.rect(sx, sy, w, 40, '#ededed');
    svg += this.text(sx + w / 2, sy + 16, '9:41', 10, '#333', 'bold', 'middle');
    svg += this.text(sx + w - 50, sy + 16, '📶 🔋', 10, '#333', 'normal', 'end');

    // WeChat nav bar
    svg += this.rect(sx, sy + 40, w, 44, '#ffffff');
    svg += this.text(sx + 16, sy + 66, '←', 16, '#333');
    svg += this.text(sx + w / 2, sy + 68, schema?.meta?.navigationBar?.title ?? '小程序预览', 15, '#333', 'bold', 'middle');
    svg += this.rect(sx + w - 80, sy + 50, 64, 24, '#f0f0f0', '#ddd', 12);
    svg += this.text(sx + w - 48, sy + 66, '•••  ✕', 10, '#666', 'normal', 'middle');

    // Content area
    const contentY = sy + 84;
    const contentH = h - 84 - 50;

    if (renderTree) {
      svg += this.drawRenderTree(renderTree, sx + 8, contentY + 8, w - 16);
    } else {
      // Sample mini-program page content
      // Banner
      svg += this.rect(sx, contentY, w, 160, '#e3f2fd');
      svg += this.text(sx + w / 2, contentY + 85, '🖼 轮播图区域', 14, '#1565c0', 'normal', 'middle');

      // Search bar
      svg += this.rect(sx + 12, contentY + 175, w - 24, 36, '#f5f5f5', '#e0e0e0', 18);
      svg += this.text(sx + 36, contentY + 198, '🔍 搜索商品...', 12, '#999');

      // Grid items
      const gridW = (w - 36) / 2;
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          const gx = sx + 12 + col * (gridW + 12);
          const gy = contentY + 230 + row * 160;
          svg += this.rect(gx, gy, gridW, 145, '#ffffff', '#f0f0f0', 8);
          svg += this.rect(gx + 4, gy + 4, gridW - 8, 80, '#f8f8f8', undefined, 4);
          svg += this.text(gx + gridW / 2, gy + 48, '🖼', 24, '#ccc', 'normal', 'middle');
          svg += this.text(gx + 8, gy + 102, '商品名称', 12, '#333', 'bold');
          svg += this.text(gx + 8, gy + 120, '¥ 99.00', 13, '#e53935', 'bold');
          svg += this.text(gx + gridW - 8, gy + 120, '已售 128', 9, '#999', 'normal', 'end');
        }
      }
    }

    // Tab bar
    const tabY = sy + h - 50;
    svg += this.rect(sx, tabY, w, 50, '#ffffff');
    svg += `<line x1="${sx}" y1="${tabY}" x2="${sx + w}" y2="${tabY}" stroke="#e0e0e0" stroke-width="1"/>`;

    const tabs = [
      { icon: '🏠', label: '首页', active: true },
      { icon: '📂', label: '分类', active: false },
      { icon: '🛒', label: '购物车', active: false },
      { icon: '👤', label: '我的', active: false },
    ];
    tabs.forEach((tab, i) => {
      const tx = sx + (w / 4) * i + w / 8;
      svg += this.text(tx, tabY + 22, tab.icon, 18, tab.active ? '#1976d2' : '#999', 'normal', 'middle');
      svg += this.text(tx, tabY + 40, tab.label, 9, tab.active ? '#1976d2' : '#999', tab.active ? 'bold' : 'normal', 'middle');
    });

    // Home indicator
    svg += this.rect(sx + w / 2 - 50, sy + h + 8, 100, 4, '#333', undefined, 2);

    svg += '</svg>';
    return svg;
  }

  /**
   * Mini-program - Operation Interface diagram.
   */
  private generateMiniprogramOperation(
    config: DiagramConfig,
    schema?: SchemaDocument,
    _renderTree?: RenderNode
  ): string {
    const w = config.width;
    const h = config.height;

    let svg = this.svgOpen(w + 40, h + 60);

    // Phone frame
    svg += this.rect(8, 8, w + 24, h + 44, '#1a1a1a', undefined, 30);

    const sx = 20;
    const sy = 30;
    svg += this.rect(sx, sy, w, h, '#ffffff');

    // Status bar
    svg += this.rect(sx, sy, w, 40, '#ededed');
    svg += this.text(sx + w / 2, sy + 16, '9:41', 10, '#333', 'bold', 'middle');

    // Nav bar
    svg += this.rect(sx, sy + 40, w, 44, '#ffffff');
    svg += this.text(sx + 16, sy + 66, '←', 16, '#333');
    svg += this.text(sx + w / 2, sy + 68, '商品详情', 15, '#333', 'bold', 'middle');
    svg += this.text(sx + w - 20, sy + 66, '⋯', 16, '#333', 'normal', 'end');

    const contentY = sy + 84;

    // Product image
    svg += this.rect(sx, contentY, w, 300, '#f0f0f0');
    svg += this.text(sx + w / 2, contentY + 150, '🖼 商品主图', 18, '#ccc', 'normal', 'middle');

    // Image dots
    for (let i = 0; i < 5; i++) {
      svg += `<circle cx="${sx + w / 2 - 24 + i * 12}" cy="${contentY + 280}" r="3" fill="${i === 0 ? '#1976d2' : '#ddd'}"/>`;
    }

    // Price section
    svg += this.rect(sx, contentY + 310, w, 60, '#ffffff');
    svg += this.text(sx + 12, contentY + 340, '¥', 14, '#e53935', 'bold');
    svg += this.text(sx + 28, contentY + 344, '199.00', 22, '#e53935', 'bold');
    svg += this.text(sx + 120, contentY + 340, '¥399.00', 12, '#999');
    // Strikethrough
    svg += `<line x1="${sx + 120}" y1="${contentY + 337}" x2="${sx + 170}" y2="${contentY + 337}" stroke="#999" stroke-width="1"/>`;
    svg += this.text(sx + w - 12, contentY + 340, '已售 2.3万', 11, '#999', 'normal', 'end');

    // Title
    svg += this.rect(sx, contentY + 375, w, 50, '#ffffff');
    svg += this.text(sx + 12, contentY + 400, '商品标题名称 限时特惠 品质保证', 15, '#333', 'bold');
    svg += this.text(sx + 12, contentY + 418, '包邮 · 7天无理由退换', 11, '#999');

    // Specs selector
    svg += this.rect(sx, contentY + 435, w, 44, '#ffffff');
    svg += this.text(sx + 12, contentY + 462, '选择', 13, '#666');
    svg += this.text(sx + 48, contentY + 462, '颜色 · 尺码', 13, '#333');
    svg += this.text(sx + w - 20, contentY + 462, '>', 14, '#ccc', 'normal', 'end');

    // Divider
    svg += this.rect(sx, contentY + 484, w, 8, '#f5f5f5');

    // Action buttons & interactions
    svg += this.rect(sx + 12, contentY + 500, 80, 28, '#ff9800', undefined, 4);
    svg += this.text(sx + 52, contentY + 519, '👆 收藏', 11, '#fff', 'bold', 'middle');

    svg += this.rect(sx + 100, contentY + 500, 80, 28, '#4caf50', undefined, 4);
    svg += this.text(sx + 140, contentY + 519, '💬 咨询', 11, '#fff', 'bold', 'middle');

    // Touch interaction indicator
    svg += `<circle cx="${sx + 52}" cy="${contentY + 514}" r="18" fill="none" stroke="#ff9800" stroke-width="2" stroke-dasharray="4,2" opacity="0.5"/>`;

    // Bottom action bar
    const barY = sy + h - 50;
    svg += this.rect(sx, barY, w, 50, '#ffffff');
    svg += `<line x1="${sx}" y1="${barY}" x2="${sx + w}" y2="${barY}" stroke="#e0e0e0" stroke-width="1"/>`;

    // Bottom buttons
    svg += this.text(sx + 30, barY + 20, '🏠', 16, '#666', 'normal', 'middle');
    svg += this.text(sx + 30, barY + 38, '首页', 9, '#666', 'normal', 'middle');

    svg += this.text(sx + 80, barY + 20, '💬', 16, '#666', 'normal', 'middle');
    svg += this.text(sx + 80, barY + 38, '客服', 9, '#666', 'normal', 'middle');

    svg += this.rect(sx + 120, barY + 6, (w - 120) / 2 - 8, 38, '#ff9800', undefined, 4);
    svg += this.text(sx + 120 + ((w - 120) / 2 - 8) / 2, barY + 30, '加入购物车', 13, '#fff', 'bold', 'middle');

    svg += this.rect(sx + 120 + (w - 120) / 2, barY + 6, (w - 120) / 2 - 8, 38, '#e53935', undefined, 4);
    svg += this.text(sx + 120 + (w - 120) / 2 + ((w - 120) / 2 - 8) / 2, barY + 30, '立即购买', 13, '#fff', 'bold', 'middle');

    // Home indicator
    svg += this.rect(sx + w / 2 - 50, sy + h + 8, 100, 4, '#333', undefined, 2);

    svg += '</svg>';
    return svg;
  }

  /**
   * Draw a schema node tree as SVG.
   */
  private drawSchemaTree(
    node: { id: string; type: string; children?: Array<{ id: string; type: string; children?: unknown[] }> },
    x: number,
    y: number,
    width: number,
    depth = 0
  ): string {
    let svg = '';
    const colors = ['#e3f2fd', '#f3e5f5', '#e8f5e9', '#fff3e0', '#fce4ec'];
    const borderColors = ['#90caf9', '#ce93d8', '#a5d6a7', '#ffcc80', '#ef9a9a'];
    const nodeH = 36;

    svg += this.rect(x, y, width, nodeH, colors[depth % 5], borderColors[depth % 5], 4);
    svg += this.text(x + 12, y + 22, `<${node.type}> #${node.id}`, 11, '#333', 'bold');

    if (node.children && Array.isArray(node.children)) {
      let childY = y + nodeH + 6;
      for (const child of node.children) {
        const typedChild = child as { id: string; type: string; children?: Array<{ id: string; type: string; children?: unknown[] }> };
        svg += this.drawSchemaTree(typedChild, x + 16, childY, width - 32, depth + 1);
        childY += this.estimateTreeHeight(typedChild) + 6;
      }
    }

    return svg;
  }

  /**
   * Draw a render tree as SVG.
   */
  private drawRenderTree(
    node: RenderNode,
    x: number,
    y: number,
    width: number,
    depth = 0
  ): string {
    let svg = '';
    const h = 30;

    // Simple component representation
    if (node.type === 'text') {
      const content = typeof node.props['content'] === 'string'
        ? node.props['content']
        : node.type;
      svg += this.text(x + 4, y + 18, content.substring(0, 30), 12, '#333');
    } else if (node.type === 'image') {
      svg += this.rect(x, y, width, 80, '#f0f0f0', '#e0e0e0', 4);
      svg += this.text(x + width / 2, y + 44, '🖼', 20, '#ccc', 'normal', 'middle');
    } else if (node.type === 'button') {
      const text = typeof node.props['text'] === 'string' ? node.props['text'] : 'Button';
      svg += this.rect(x + 12, y, width - 24, h, '#1976d2', undefined, 4);
      svg += this.text(x + width / 2, y + 20, text, 12, '#fff', 'bold', 'middle');
    } else {
      // Container
      svg += this.rect(x, y, width, h, 'transparent', '#e0e0e0', 0);
    }

    if (node.children) {
      let childY = y + h + 4;
      for (const child of node.children) {
        svg += this.drawRenderTree(child, x + 4, childY, width - 8, depth + 1);
        childY += 36;
      }
    }

    return svg;
  }

  private estimateTreeHeight(
    node: { children?: unknown[] }
  ): number {
    if (!node.children || !Array.isArray(node.children) || node.children.length === 0) return 36;
    let h = 42;
    for (const child of node.children) {
      h += this.estimateTreeHeight(child as { children?: unknown[] }) + 6;
    }
    return h;
  }

  // ─── SVG Helpers ────────────────────────────────────────────

  private svgOpen(w: number, h: number): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
  }

  private rect(
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    stroke?: string,
    rx?: number
  ): string {
    let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"`;
    if (stroke) s += ` stroke="${stroke}" stroke-width="1"`;
    if (rx !== undefined) s += ` rx="${rx}"`;
    s += '/>';
    return s;
  }

  private text(
    x: number,
    y: number,
    content: string,
    size: number,
    fill: string,
    weight = 'normal',
    anchor = 'start'
  ): string {
    const escaped = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<text x="${x}" y="${y}" font-family="Arial, 'PingFang SC', sans-serif" font-size="${size}" fill="${fill}" font-weight="${weight}" text-anchor="${anchor}">${escaped}</text>`;
  }
}
