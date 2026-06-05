import { describe, expect, it } from 'vitest';
import { makeWeChatCompatible } from './wechatCompat';

describe('makeWeChatCompatible', () => {
    it('removes undeletable top spacing from the WeChat wrapper and first content block', async () => {
        const html = '<div><h1 style="margin-top: 32px;">Title</h1><p style="margin-top: 20px;">Body</p></div>';
        const compatible = await makeWeChatCompatible(html, 'apple');
        const doc = new DOMParser().parseFromString(compatible, 'text/html');
        const section = doc.querySelector('section');
        const heading = doc.querySelector('h1');
        const paragraph = doc.querySelector('p');

        expect(section?.getAttribute('style')).toContain('padding-top: 0 !important;');
        expect(section?.getAttribute('style')).toContain('padding-right: 0 !important;');
        expect(section?.getAttribute('style')).toContain('padding-bottom: 0 !important;');
        expect(section?.getAttribute('style')).toContain('padding-left: 0 !important;');
        expect(section?.getAttribute('style')).toContain('padding: 0 0 0 0 !important;');
        expect(heading?.getAttribute('style')).toContain('margin-top: 0 !important;');
        expect(paragraph?.getAttribute('style')).toContain('margin-top: 20px;');
        expect(paragraph?.getAttribute('style')).not.toContain('margin-top: 0 !important;');
        expect(paragraph?.getAttribute('style')).toContain('margin-bottom: 0 !important;');
    });

    it('also resets the first visible subheading', async () => {
        const html = '<div><h2 style="margin: 32px 0 16px;">Subtitle</h2><p>Body</p></div>';
        const compatible = await makeWeChatCompatible(html, 'apple');
        const doc = new DOMParser().parseFromString(compatible, 'text/html');
        const heading = doc.querySelector('h2');

        expect(heading?.getAttribute('style')).toContain('margin-top: 0 !important;');
    });

    it('removes trailing blank space after a single paragraph', async () => {
        const html = '<div><p style="margin: 18px 0 !important;">测试内容</p></div>';
        const compatible = await makeWeChatCompatible(html, 'apple');
        const doc = new DOMParser().parseFromString(compatible, 'text/html');
        const section = doc.querySelector('section');
        const paragraph = doc.querySelector('p');

        expect(section?.getAttribute('style')).toContain('padding: 0 0 0 0 !important;');
        expect(paragraph?.getAttribute('style')).toContain('margin: 0 0 0 0 !important;');
        expect(paragraph?.getAttribute('style')).toContain('margin-top: 0 !important;');
        expect(paragraph?.getAttribute('style')).toContain('margin-bottom: 0 !important;');
    });
});
