# Готовит копию сайта для GitHub Pages «для своих»: noindex везде, без sitemap.
# Запускается в GitHub Actions (.github/workflows/pages.yml) после пуша в main.
import glob, os, re
open('robots.txt', 'w').write('User-agent: *\nDisallow: /\n')
if os.path.exists('sitemap.xml'): os.remove('sitemap.xml')
open('.nojekyll', 'w').close()
for f in glob.glob('*.html') + glob.glob('d/*.html'):
    s = open(f, encoding='utf-8').read()
    tag = '<meta name="robots" content="noindex, nofollow">'
    if 'name="robots"' in s: s = re.sub(r'<meta name="robots"[^>]*>', tag, s)
    else: s = s.replace('<head>', '<head>\n' + tag, 1)
    open(f, 'w', encoding='utf-8').write(s)
