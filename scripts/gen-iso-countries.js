const https = require('https');
const url =
  'https://raw.githubusercontent.com/lukes/ISO-3166-Countries-with-Regional-Codes/master/slim-2/slim-2.json';
https
  .get(url, (r) => {
    let d = '';
    r.on('data', (c) => {
      d += c;
    });
    r.on('end', () => {
      const j = JSON.parse(d);
      const lines = j.map(
        (x) => `  { code: '${x['alpha-2']}', name: ${JSON.stringify(x.name)} },`
      );
      process.stdout.write(
        `/** ISO 3166-1 alpha-2 + English short name (generated). */\nexport const ISO2_COUNTRY_OPTIONS = [\n${lines.join('\n')}\n];\n`
      );
    });
  })
  .on('error', (e) => {
    console.error(e);
    process.exit(1);
  });
