import * as fs from 'fs';
import * as path from 'path';

const getTemplatePath = () => {
  const altPath = path.join(process.cwd(), 'src', 'notifications', 'templates', 'templates.json');
  if (fs.existsSync(altPath)) return altPath;
  return path.join(__dirname, 'templates', 'templates.json');
};

export function getTemplates(): Record<string, { subject?: string; body: string }> {
  const targetPath = getTemplatePath();
  try {
    if (fs.existsSync(targetPath)) {
      return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to read templates.json', e);
  }
  return {};
}

export function compileTemplate(text: string, context: Record<string, any>): string {
  if (!text) return '';
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
    return context[key] !== undefined ? String(context[key]) : match;
  });
}
