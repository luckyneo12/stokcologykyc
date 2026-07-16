const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const t = await prisma.pdfTemplate.findFirst({ where: { isActive: true } });
  let fields = JSON.parse(t.fields);
  let changed = false;
  
  if (fields.pages) {
    fields.pages = fields.pages.map(page => {
      if (page.type === 'html' && page.content && page.content.includes('<html')) {
        const bodyMatch = page.content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        const styleMatch = page.content.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
        
        if (bodyMatch) {
          let styles = styleMatch ? `<style>${styleMatch[1].replace(/\bbody\b/gi, '.kyc-template-body')}</style>` : '';
          page.content = `${styles}\n<div class="kyc-template-body" style="width:100%;min-height:100%;">${bodyMatch[1]}</div>`;
          changed = true;
        }
      }
      return page;
    });
  }
  
  if (changed) {
    await prisma.pdfTemplate.update({
      where: { id: t.id },
      data: { fields: JSON.stringify(fields) }
    });
    console.log('Template fixed!');
  } else {
    console.log('No fixes needed');
  }
}
run();
