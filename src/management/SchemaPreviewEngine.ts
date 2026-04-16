/**
 * SchemaPreviewEngine - Preview Schema with Data
 *
 * Provides schema preview capabilities with mock or real data,
 * supporting different device configurations (desktop, mobile, miniprogram).
 */

import { BindingEngine } from '../core/BindingEngine';
import { Renderer } from '../core/Renderer';
import type { SchemaDocument, DataContext, RenderNode } from '../types';
import type { PreviewConfig, PreviewSnapshot } from './types';

/** Default preview configurations for different modes */
const DEFAULT_PREVIEW_CONFIGS: Record<string, PreviewConfig> = {
  desktop: {
    mode: 'desktop',
    width: 1280,
    height: 800,
    devicePixelRatio: 1,
    showOutlines: false,
    showBindings: false,
  },
  mobile: {
    mode: 'mobile',
    width: 375,
    height: 812,
    devicePixelRatio: 3,
    showOutlines: false,
    showBindings: false,
  },
  miniprogram: {
    mode: 'miniprogram',
    width: 375,
    height: 667,
    devicePixelRatio: 2,
    showOutlines: false,
    showBindings: false,
  },
};

export class SchemaPreviewEngine {
  private bindingEngine: BindingEngine;
  private renderer: Renderer;

  constructor() {
    this.bindingEngine = new BindingEngine(false);
    this.renderer = new Renderer(false);
  }

  /**
   * Generate a preview snapshot for a schema with given data.
   */
  preview(
    schema: SchemaDocument,
    data: DataContext,
    config?: Partial<PreviewConfig>
  ): PreviewSnapshot {
    const previewConfig = this.resolveConfig(config);

    // Bind schema with data
    const renderTree = this.bindingEngine.resolve(schema.root, data);

    if (!renderTree) {
      throw new Error(
        'PreviewEngine: Root node resolved to null - the page is conditionally hidden'
      );
    }

    // Generate SVG diagram
    const diagram = this.generatePreviewDiagram(
      renderTree,
      previewConfig
    );

    return {
      renderTree,
      dataContext: data,
      config: previewConfig,
      timestamp: new Date().toISOString(),
      diagram,
    };
  }

  /**
   * Generate a preview with empty/default data to show the schema structure.
   */
  previewStructure(
    schema: SchemaDocument,
    config?: Partial<PreviewConfig>
  ): PreviewSnapshot {
    const emptyData: DataContext = {};
    const previewConfig = {
      ...this.resolveConfig(config),
      showOutlines: true,
      showBindings: true,
    };

    const renderTree = this.bindingEngine.resolve(
      schema.root,
      emptyData
    );

    if (!renderTree) {
      throw new Error(
        'PreviewEngine: Root node resolved to null with empty data'
      );
    }

    const diagram = this.generatePreviewDiagram(
      renderTree,
      previewConfig
    );

    return {
      renderTree,
      dataContext: emptyData,
      config: previewConfig,
      timestamp: new Date().toISOString(),
      diagram,
    };
  }

  /**
   * Get default preview config for a mode.
   */
  getDefaultConfig(
    mode: 'desktop' | 'mobile' | 'miniprogram'
  ): PreviewConfig {
    return { ...DEFAULT_PREVIEW_CONFIGS[mode] };
  }

  /**
   * Count the number of nodes in a render tree.
   */
  countRenderNodes(node: RenderNode): number {
    let count = 1;
    if (node.children) {
      for (const child of node.children) {
        count += this.countRenderNodes(child);
      }
    }
    return count;
  }

  /**
   * Generate SVG diagram of the preview.
   */
  private generatePreviewDiagram(
    renderTree: RenderNode,
    config: PreviewConfig
  ): string {
    const padding = 20;
    const headerHeight = 60;
    const svgWidth = config.width + padding * 2;
    const svgHeight = config.height + padding * 2 + headerHeight;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">`;

    // Background
    svg += `<rect width="${svgWidth}" height="${svgHeight}" fill="#f0f2f5" rx="8"/>`;

    // Device frame
    if (config.mode === 'miniprogram' || config.mode === 'mobile') {
      svg += this.drawMobileFrame(
        padding,
        headerHeight,
        config.width,
        config.height,
        config.mode
      );
    } else {
      svg += this.drawDesktopFrame(
        padding,
        headerHeight,
        config.width,
        config.height
      );
    }

    // Header
    svg += `<text x="${svgWidth / 2}" y="30" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#333">`;
    svg += `Preview: ${config.mode} (${config.width}×${config.height})`;
    svg += `</text>`;

    // Render nodes as rectangles
    let yOffset = headerHeight + padding + 10;
    svg += this.renderNodeToSvg(
      renderTree,
      padding + 10,
      yOffset,
      config.width - 20,
      config
    );

    svg += `</svg>`;
    return svg;
  }

  /**
   * Render a node tree as SVG elements recursively.
   */
  private renderNodeToSvg(
    node: RenderNode,
    x: number,
    y: number,
    width: number,
    config: PreviewConfig,
    depth = 0
  ): string {
    let svg = '';
    const height = this.estimateNodeHeight(node);
    const colors = ['#e3f2fd', '#f3e5f5', '#e8f5e9', '#fff3e0', '#fce4ec'];
    const fillColor = colors[depth % colors.length];
    const borderColor = config.showOutlines ? '#1976d2' : '#e0e0e0';

    // Node rectangle
    svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" `;
    svg += `fill="${fillColor}" stroke="${borderColor}" stroke-width="1" rx="4"/>`;

    // Type label
    svg += `<text x="${x + 8}" y="${y + 16}" font-family="Arial, sans-serif" font-size="11" fill="#333" font-weight="bold">`;
    svg += `&lt;${node.type}&gt;`;
    svg += `</text>`;

    // Show binding info
    if (config.showBindings && node.props) {
      const bindingProps = Object.entries(node.props)
        .filter(([, v]) => typeof v === 'string' && String(v).includes('{{'))
        .map(([k]) => k);
      if (bindingProps.length > 0) {
        svg += `<text x="${x + 8}" y="${y + 30}" font-family="monospace" font-size="9" fill="#1565c0">`;
        svg += `bindings: ${bindingProps.join(', ')}`;
        svg += `</text>`;
      }
    }

    // Render children
    if (node.children) {
      let childY = y + 40;
      const childWidth = width - 20;
      for (const child of node.children) {
        svg += this.renderNodeToSvg(
          child,
          x + 10,
          childY,
          childWidth,
          config,
          depth + 1
        );
        childY += this.estimateNodeHeight(child) + 5;
      }
    }

    return svg;
  }

  private estimateNodeHeight(node: RenderNode): number {
    if (!node.children || node.children.length === 0) return 40;
    let childrenHeight = 0;
    for (const child of node.children) {
      childrenHeight += this.estimateNodeHeight(child) + 5;
    }
    return 45 + childrenHeight;
  }

  private drawMobileFrame(
    x: number,
    y: number,
    width: number,
    height: number,
    mode: string
  ): string {
    let svg = '';
    // Phone frame
    svg += `<rect x="${x - 5}" y="${y - 5}" width="${width + 10}" height="${height + 10}" `;
    svg += `fill="#1a1a1a" rx="20" ry="20"/>`;
    // Screen area
    svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#ffffff" rx="4"/>`;
    // Status bar
    svg += `<rect x="${x}" y="${y}" width="${width}" height="24" fill="#f8f8f8" rx="4"/>`;
    svg += `<text x="${x + width / 2}" y="${y + 16}" text-anchor="middle" font-family="Arial" font-size="10" fill="#666">`;
    svg += mode === 'miniprogram' ? '微信小程序' : 'Mobile Preview';
    svg += `</text>`;
    return svg;
  }

  private drawDesktopFrame(
    x: number,
    y: number,
    width: number,
    height: number
  ): string {
    let svg = '';
    // Browser frame
    svg += `<rect x="${x - 2}" y="${y - 30}" width="${width + 4}" height="${height + 32}" `;
    svg += `fill="#e0e0e0" rx="8" ry="8"/>`;
    // Browser toolbar
    svg += `<circle cx="${x + 12}" cy="${y - 15}" r="5" fill="#ff5f57"/>`;
    svg += `<circle cx="${x + 28}" cy="${y - 15}" r="5" fill="#ffbd2e"/>`;
    svg += `<circle cx="${x + 44}" cy="${y - 15}" r="5" fill="#27c93f"/>`;
    // URL bar
    svg += `<rect x="${x + 60}" y="${y - 22}" width="${width - 70}" height="14" fill="#ffffff" rx="3"/>`;
    // Screen area
    svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#ffffff"/>`;
    return svg;
  }

  private resolveConfig(
    partial?: Partial<PreviewConfig>
  ): PreviewConfig {
    const mode = partial?.mode ?? 'mobile';
    const defaults = DEFAULT_PREVIEW_CONFIGS[mode] ?? DEFAULT_PREVIEW_CONFIGS['mobile'];
    return { ...defaults, ...partial };
  }
}
