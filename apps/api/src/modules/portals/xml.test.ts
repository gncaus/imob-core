import { describe, expect, it } from 'vitest';
import { cdata, el, escapeXml, renderXmlDocument } from './xml.js';

describe('xml', () => {
  it('escapes special characters in text and attributes', () => {
    const root = el('A', 'Tom & Jerry <3', { title: 'aspas "duplas" e \'simples\'' })!;

    expect(renderXmlDocument(root)).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<A title="aspas &quot;duplas&quot; e &apos;simples&apos;">Tom &amp; Jerry &lt;3</A>\n',
    );
  });

  it('keeps accents as-is and wraps CDATA content', () => {
    const root = el('City', cdata('Vitória & região'))!;

    expect(renderXmlDocument(root)).toContain('<City><![CDATA[Vitória & região]]></City>');
  });

  it('splits a CDATA terminator inside the content', () => {
    const root = el('D', cdata('a ]]> b'))!;

    expect(renderXmlDocument(root)).toContain('<D><![CDATA[a ]]]]><![CDATA[> b]]></D>');
  });

  it('removes characters that are invalid in XML 1.0', () => {
    expect(escapeXml('ok\u0000\u0008\u001Ffim\ttab')).toBe('okfim\ttab');
  });

  it('omits null children and undefined attributes, and indents nested elements', () => {
    const root = el('Root', [el('A', 1), el('B', null), el('C', 'x', { unit: undefined })])!;

    expect(renderXmlDocument(root)).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n<Root>\n  <A>1</A>\n  <C>x</C>\n</Root>\n',
    );
  });

  it('self-closes an element whose children are all omitted', () => {
    expect(renderXmlDocument(el('Empty', [el('A', undefined)])!)).toContain('<Empty/>');
  });
});
