/**
 * Construtor mínimo de XML para os feeds: escape correto, CDATA seguro e saída indentada.
 * Elementos com conteúdo nulo ou indefinido são omitidos, o que simplifica campos opcionais.
 */

export interface XmlElement {
  kind: 'element';
  name: string;
  attrs: Record<string, string>;
  content: XmlContent;
}

interface Cdata {
  kind: 'cdata';
  text: string;
}

type XmlChild = XmlElement | null | undefined | false;
type XmlContent = string | Cdata | XmlChild[];

/** Caracteres proibidos em XML 1.0 (controle, exceto tab e quebras de linha). */
// eslint-disable-next-line no-control-regex
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function sanitize(text: string): string {
  return text.replace(INVALID_XML_CHARS, '');
}

export function escapeXml(text: string): string {
  return sanitize(text).replace(/[&<>"']/g, (char) => ESCAPES[char]!);
}

/** Texto em CDATA. Um `]]>` no conteúdo é dividido em duas seções para não fechar a primeira. */
export function cdata(text: string): Cdata {
  return { kind: 'cdata', text: sanitize(text) };
}

/**
 * Cria um elemento. Conteúdo `null`/`undefined` omite o elemento inteiro; números viram texto.
 * Atributos com valor `undefined` são ignorados.
 */
export function el(
  name: string,
  content: string | number | Cdata | XmlChild[] | null | undefined,
  attrs: Record<string, string | undefined> = {},
): XmlElement | null {
  if (content === null || content === undefined) return null;
  const definedAttrs: Record<string, string> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined) definedAttrs[key] = value;
  }
  return {
    kind: 'element',
    name,
    attrs: definedAttrs,
    content: typeof content === 'number' ? String(content) : content,
  };
}

function renderAttrs(attrs: Record<string, string>): string {
  return Object.entries(attrs)
    .map(([key, value]) => ` ${key}="${escapeXml(value)}"`)
    .join('');
}

function renderElement(element: XmlElement, depth: number): string {
  const indent = '  '.repeat(depth);
  const open = `${indent}<${element.name}${renderAttrs(element.attrs)}`;
  const { content } = element;

  if (typeof content === 'string') {
    return `${open}>${escapeXml(content)}</${element.name}>`;
  }
  if (!Array.isArray(content)) {
    const safe = content.text.split(']]>').join(']]]]><![CDATA[>');
    return `${open}><![CDATA[${safe}]]></${element.name}>`;
  }

  const children = content.filter((child): child is XmlElement => Boolean(child));
  if (children.length === 0) return `${open}/>`;
  const inner = children.map((child) => renderElement(child, depth + 1)).join('\n');
  return `${open}>\n${inner}\n${indent}</${element.name}>`;
}

export function renderXmlDocument(root: XmlElement): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${renderElement(root, 0)}\n`;
}
