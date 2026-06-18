import { THEMES } from './themes';
import { stripIndexMarkers } from './markdownIndexer';

/**
 * Remove internal editor attributes from HTML
 * Used when exporting to avoid including internal implementation details
 *
 * This is now a thin wrapper around stripIndexMarkers from the indexing layer.
 * Keeping this function for backward compatibility.
 */
export function cleanInternalAttributes(html: string): string {
    return stripIndexMarkers(html);
}

// Helper to convert images to Base64
async function getBase64Image(imgUrl: string): Promise<string> {
    try {
        if (imgUrl.startsWith('data:')) return imgUrl;

        const response = await fetch(imgUrl, { mode: 'cors', cache: 'default' });
        if (!response.ok) return imgUrl;

        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(imgUrl);
            reader.readAsDataURL(blob);
        });
    } catch {
        return imgUrl;
    }
}

function appendImportantStyle(currentStyle: string, declaration: string): string {
    const separator = currentStyle.trim() && !currentStyle.trim().endsWith(';') ? '; ' : ' ';
    return `${currentStyle}${separator}${declaration}`.trim();
}

function zeroBoxSpacingInStyle(style: string, property: 'margin' | 'padding', edges: { top?: boolean; right?: boolean; bottom?: boolean; left?: boolean }): string {
    return style.replace(new RegExp(`${property}:\\s*([^;]+);?`, 'gi'), (_match, spacingValue: string) => {
        const cleanValue = spacingValue.replace(/\s*!important\s*/gi, '').trim();
        const parts = cleanValue.split(/\s+/);
        if (parts.length === 0) return `${property}: 0 !important;`;

        let top = parts[0];
        let rightValue = parts[1] || top;
        let bottom = parts[2] || top;
        let leftValue = parts[3] || rightValue;
        if (edges.top) top = '0';
        if (edges.right) rightValue = '0';
        if (edges.bottom) bottom = '0';
        if (edges.left) leftValue = '0';
        return `${property}: ${top} ${rightValue} ${bottom} ${leftValue} !important;`;
    });
}

function isVisibleContentElement(element: Element): boolean {
    if (['IMG', 'TABLE', 'PRE'].includes(element.tagName)) return true;
    return Boolean((element.textContent || '').trim());
}

function isMacTrafficLightBar(element: Element): boolean {
    if (element.tagName !== 'DIV') return false;
    if (element.parentElement?.tagName !== 'PRE') return false;

    const children = Array.from(element.children);
    if (children.length !== 3 || !children.every(child => child.tagName === 'SPAN')) return false;

    const wrapperStyle = element.getAttribute('style') || '';
    const looksLikeToolbarSpacing = /margin-bottom\s*:\s*12px/i.test(wrapperStyle);
    const looksLikeTrafficLights = children.every(child => {
        const style = child.getAttribute('style') || '';
        return (
            /display\s*:\s*inline-block/i.test(style) &&
            /width\s*:\s*12px/i.test(style) &&
            /height\s*:\s*12px/i.test(style) &&
            /border-radius\s*:\s*50%/i.test(style) &&
            /background\s*:\s*#(?:ff5f56|ffbd2e|27c93f)/i.test(style)
        );
    });

    return looksLikeToolbarSpacing && looksLikeTrafficLights;
}

function removeUnsupportedCodeChrome(section: HTMLElement): void {
    section.querySelectorAll('pre').forEach(pre => {
        const firstElementChild = Array.from(pre.children)[0];
        if (firstElementChild && isMacTrafficLightBar(firstElementChild)) {
            firstElementChild.remove();
        }
    });
}

export async function makeWeChatCompatible(html: string, themeId: string): Promise<string> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
    const containerStyle = theme.styles.container || '';

    // 0. Remove internal editor attributes (for click-to-locate feature)
    // These are only used in the editor and should not appear in the final HTML
    const allElements = doc.querySelectorAll('*');
    allElements.forEach(el => {
        el.removeAttribute('data-md-type');
        el.removeAttribute('data-md-index');
    });

    // Note: We manually remove attributes here before DOM manipulation
    // The stripIndexMarkers() function is also available for HTML string operations

    // 1. WeChat prefers <section> as the root wrapper for overall styling
    // If the root is a div, let's wrap or convert it to a section.
    const rootNodes = Array.from(doc.body.children);

    // Create new wrap section
    const section = doc.createElement('section');
    section.setAttribute('style', containerStyle);

    rootNodes.forEach(node => {
        // If the original html came from applyTheme it already has a root div
        // We strip it regardless of exact style string match to avoid double layers
        if (node.tagName === 'DIV' && rootNodes.length === 1) {
            Array.from(node.childNodes).forEach(child => section.appendChild(child));
        } else {
            section.appendChild(node);
        }
    });

    // WeChat already has its own editor inset, while pasted root padding becomes
    // visible indentation/blank space, so neutralize container padding only here.
    let sectionStyle = zeroBoxSpacingInStyle(section.getAttribute('style') || '', 'padding', { top: true, right: true, bottom: true, left: true });
    sectionStyle = appendImportantStyle(sectionStyle, 'padding-top: 0 !important;');
    sectionStyle = appendImportantStyle(sectionStyle, 'padding-right: 0 !important;');
    sectionStyle = appendImportantStyle(sectionStyle, 'padding-bottom: 0 !important;');
    sectionStyle = appendImportantStyle(sectionStyle, 'padding-left: 0 !important;');
    sectionStyle = appendImportantStyle(sectionStyle, 'margin-top: 0 !important;');
    sectionStyle = appendImportantStyle(sectionStyle, 'margin-bottom: 0 !important;');
    section.setAttribute('style', sectionStyle);

    const visibleBlocks = Array.from(section.querySelectorAll('h1, h2, h3, h4, h5, h6, p, blockquote, table, img, pre, ul, ol')).filter(isVisibleContentElement);
    const firstVisibleBlock = visibleBlocks[0];
    if (firstVisibleBlock) {
        firstVisibleBlock.setAttribute(
            'style',
            appendImportantStyle(
                zeroBoxSpacingInStyle(firstVisibleBlock.getAttribute('style') || '', 'margin', { top: true }),
                'margin-top: 0 !important;'
            )
        );
    }

    const lastVisibleBlock = visibleBlocks[visibleBlocks.length - 1];
    if (lastVisibleBlock) {
        lastVisibleBlock.setAttribute(
            'style',
            appendImportantStyle(
                zeroBoxSpacingInStyle(lastVisibleBlock.getAttribute('style') || '', 'margin', { bottom: true }),
                'margin-bottom: 0 !important;'
            )
        );
    }

    // WeChat often strips the small traffic-light spans in Mac-style code blocks
    // but leaves their wrapper spacing behind. Remove that decoration for pasted
    // HTML so code starts at the expected position instead of showing a blank bar.
    removeUnsupportedCodeChrome(section);

    // 2. WeChat ignores flex in many scenarios. Convert image flex wrappers to table layout.
    const flexLikeNodes = section.querySelectorAll('div, p.image-grid');
    flexLikeNodes.forEach(node => {
        // Keep code block internals untouched.
        if (node.closest('pre, code')) return;

        const style = node.getAttribute('style') || '';
        const isFlexNode = style.includes('display: flex') || style.includes('display:flex');
        const isImageGrid = node.classList.contains('image-grid');
        if (!isFlexNode && !isImageGrid) return;

        const flexChildren = Array.from(node.children);
        if (flexChildren.every(child => child.tagName === 'IMG' || child.querySelector('img'))) {
            const table = doc.createElement('table');
            table.setAttribute('style', 'width: 100%; border-collapse: collapse; margin: 16px 0; border: none !important;');
            const tbody = doc.createElement('tbody');
            const tr = doc.createElement('tr');
            tr.setAttribute('style', 'border: none !important; background: transparent !important;');

            flexChildren.forEach(child => {
                const td = doc.createElement('td');
                td.setAttribute('style', 'padding: 0 4px; vertical-align: top; border: none !important; background: transparent !important;');
                td.appendChild(child);
                // Update child width to 100% since it's now bound by TD
                if (child.tagName === 'IMG') {
                    const currentStyle = child.getAttribute('style') || '';
                    child.setAttribute('style', currentStyle.replace(/width:\s*[^;]+;?/g, '') + ' width: 100% !important; display: block; margin: 0 auto;');
                }
                tr.appendChild(td);
            });

            tbody.appendChild(tr);
            table.appendChild(tbody);
            node.parentNode?.replaceChild(table, node);
        } else if (isFlexNode) {
            // Non-image flex items just get stripped of flex.
            node.setAttribute('style', style.replace(/display:\s*flex;?/g, 'display: block;'));
        }
    });

    // 3. List Item Flattening
    // WeChat notoriously misrenders heavily nested <li> formatting, flattening the inner structure helps
    const listItems = section.querySelectorAll('li');
    listItems.forEach(li => {
        const hasBlockChildren = Array.from(li.children).some(child =>
            ['P', 'DIV', 'UL', 'OL', 'BLOCKQUOTE'].includes(child.tagName)
        );
        if (hasBlockChildren) {
            // We only want to clean inner tags if it's overly complex, 
            // but flattening everything might kill <strong> or <em>.
            // Let's just strip 'p' inside 'li' by replacing <p> with <span>
            const ps = li.querySelectorAll('p');
            ps.forEach(p => {
                const span = doc.createElement('span');
                span.innerHTML = p.innerHTML;
                const pStyle = p.getAttribute('style');
                if (pStyle) span.setAttribute('style', pStyle);
                p.parentNode?.replaceChild(span, p);
            });
        }
    });

    // 4. Force Inheritance
    // WeChat's editor aggressively overrides inherited fonts on <p>, <li>, etc.
    // So we manually distribute the container's font properties to all individual blocks.
    const fontMatch = containerStyle.match(/font-family:\s*([^;]+);/);
    const sizeMatch = containerStyle.match(/font-size:\s*([^;]+);/);
    const colorMatch = containerStyle.match(/color:\s*([^;]+);/);
    const lineHeightMatch = containerStyle.match(/line-height:\s*([^;]+);/);

    // We only enforce on specific text tags that WeChat likes to hijack
    const textNodes = section.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, span');
    textNodes.forEach(node => {
        // Preserve code highlighting tokens inside code blocks.
        if (node.tagName === 'SPAN' && node.closest('pre, code')) return;

        let currentStyle = node.getAttribute('style') || '';

        if (fontMatch && !currentStyle.includes('font-family:')) {
            currentStyle += ` font-family: ${fontMatch[1]};`;
        }
        if (lineHeightMatch && !currentStyle.includes('line-height:')) {
            currentStyle += ` line-height: ${lineHeightMatch[1]};`;
        }
        // Add font-size if not present (only for standard text nodes so we don't shrink headings)
        if (sizeMatch && !currentStyle.includes('font-size:') && ['P', 'LI', 'BLOCKQUOTE', 'SPAN'].includes(node.tagName)) {
            currentStyle += ` font-size: ${sizeMatch[1]};`;
        }
        if (colorMatch && !currentStyle.includes('color:')) {
            currentStyle += ` color: ${colorMatch[1]};`;
        }

        node.setAttribute('style', currentStyle.trim());
    });

    // Keep CJK punctuation attached to preceding inline emphasis in WeChat.
    // Example: <strong>标题</strong>：说明 -> <strong>标题：</strong>说明
    const inlineNodes = section.querySelectorAll('strong, b, em, span, a, code');
    inlineNodes.forEach(node => {
        const next = node.nextSibling;
        if (!next || next.nodeType !== Node.TEXT_NODE) return;
        const text = next.textContent || '';
        const match = text.match(/^\s*([：；，。！？、:])(.*)$/s);
        if (!match) return;

        const punct = match[1];
        const rest = match[2] || '';
        node.appendChild(doc.createTextNode(punct));
        if (rest) {
            next.textContent = rest;
        } else {
            next.parentNode?.removeChild(next);
        }
    });

    // 5. Convert all images to Base64 for safe WeChat pasting
    const imgs = Array.from(section.querySelectorAll('img'));
    await Promise.all(imgs.map(async img => {
        const src = img.getAttribute('src');
        if (src && !src.startsWith('data:')) {
            const base64 = await getBase64Image(src);
            img.setAttribute('src', base64);
        }
    }));

    doc.body.innerHTML = '';
    doc.body.appendChild(section);

    // Prevent WeChat from breaking lines between inline emphasis and leading CJK punctuation.
    // Example: </strong>： should stay on the same line.
    let outputHtml = doc.body.innerHTML;
    outputHtml = outputHtml.replace(/(<\/(?:strong|b|em|span|a|code)>)\s*([：；，。！？、])/g, '$1\u2060$2');

    return outputHtml;
}
