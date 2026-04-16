/**
 * Screenshot Tool - Captures runtime screenshots of the management platform pages.
 *
 * Uses Playwright to open each HTML page in a real Chromium browser
 * and take pixel-perfect PNG screenshots.
 */

import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const PLATFORM_DIR = path.resolve(__dirname, '../platform');
const OUTPUT_DIR = path.resolve(__dirname, '../docs/screenshots');

interface ScreenshotConfig {
  /** HTML file name */
  file: string;
  /** Output PNG file name */
  output: string;
  /** Viewport width */
  width: number;
  /** Viewport height */
  height: number;
  /** Description */
  description: string;
}

const PAGES: ScreenshotConfig[] = [
  {
    file: 'management-design.html',
    output: 'management-design.png',
    width: 1440,
    height: 900,
    description: '管理平台 - 设计界面',
  },
  {
    file: 'management-preview.html',
    output: 'management-preview.png',
    width: 1440,
    height: 900,
    description: '管理平台 - 预览界面',
  },
  {
    file: 'miniprogram-preview.html',
    output: 'miniprogram-preview.png',
    width: 430,
    height: 900,
    description: '小程序端 - 预览界面',
  },
  {
    file: 'miniprogram-operation.html',
    output: 'miniprogram-operation.png',
    width: 430,
    height: 900,
    description: '小程序端 - 操作界面',
  },
];

async function captureScreenshots(): Promise<void> {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('🚀 Starting screenshot capture...\n');

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  for (const config of PAGES) {
    const htmlPath = path.join(PLATFORM_DIR, config.file);
    const outputPath = path.join(OUTPUT_DIR, config.output);
    const fileUrl = `file://${htmlPath}`;

    console.log(`📸 ${config.description}`);
    console.log(`   File: ${config.file}`);
    console.log(`   Viewport: ${config.width}×${config.height}`);

    const context = await browser.newContext({
      viewport: { width: config.width, height: config.height },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    await page.goto(fileUrl, { waitUntil: 'networkidle' });

    // Wait for fonts to fully load and rendering to settle
    await page.evaluate(async () => { await document.fonts.ready; });
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: outputPath,
      fullPage: false,
    });

    console.log(`   ✅ Saved: ${config.output}\n`);
    await context.close();
  }

  await browser.close();

  console.log(`🎉 All ${PAGES.length} screenshots captured successfully!`);
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
}

captureScreenshots().catch((err) => {
  console.error('❌ Screenshot capture failed:', err);
  process.exit(1);
});
