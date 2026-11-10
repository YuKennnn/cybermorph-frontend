import fs from 'node:fs'

const files = fs.readdirSync('src/views').filter((f) => f.endsWith('.vue'))
for (const f of files) {
  const content = fs.readFileSync('src/views/' + f, 'utf8')
  const m = content.match(/<template>[\s\r\n]*<([a-zA-Z0-9_-]+)([^>]*)>/)
  if (m) {
    const classMatch = m[2].match(/class=["']([^"']+)["']/)
    console.log(f.padEnd(30), '=>', m[1], classMatch ? `class="${classMatch[1]}"` : '(no class)')
  } else {
    console.log(f.padEnd(30), '=> (no template match)')
  }
}
