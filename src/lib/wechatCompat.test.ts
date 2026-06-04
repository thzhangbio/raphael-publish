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
        expect(heading?.getAttribute('style')).toContain('margin-top: 0 !important;');
        expect(paragraph?.getAttribute('style')).toContain('margin-top: 20px;');
        expect(paragraph?.getAttribute('style')).not.toContain('margin-top: 0 !important;');
    });
});
