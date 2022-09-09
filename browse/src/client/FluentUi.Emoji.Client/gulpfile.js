/// <binding AfterBuild='default' />
const { src, dest } = require('gulp');
const { parse, sep } = require('path');
const { readFileSync, writeFileSync } = require('fs');

function build(cb) {
    const stream = src('../../../../assets/**/*.*', { read: false });
    const map = new Map();
    stream.on('error', () => console.error('not sure why this happened!'));
    stream.on('data', file => {
        const parsed = parse(file.path);
        if (parsed) {
            const ext = parsed.ext;
            const split = parsed.dir.split(sep);
            const index = split.lastIndexOf('assets');
            const named = split.slice(index + 1);
            const name = named[0];
            const route = named.join('/').concat(`/${parsed.base}`).replaceAll(' ', '_');
            const factory = () => {
                if (ext === '.json') {
                    const json = readFileSync(file.path, 'utf8');
                    return {
                        'metadata': JSON.parse(json)
                    }
                } else {
                    return {
                        'routes': [
                            `emoji/${route}`
                        ]
                    };
                }
            };
            const created = factory();
            if (route.indexOf('Default') > -1) {
                created['hasVariations'] = true;
            }

            if (map.has(name)) {
                const existing = map.get(name);
                if (created['routes'] && existing['routes']) {
                    created['routes'] = [
                        ...created['routes'],
                        ...existing['routes']
                    ];
                }

                const updated = {
                    ...existing,
                    ...created
                };
                map.set(name, updated);

            } else {
                map.set(name, created);
            }
        } else {
            console.error('Unable to parse file path');
        }
    });

    stream.on('end', () => {
        const path = ['wwwroot', 'emoji', 'all.g.json'].join(sep);
        writeFileSync(path, JSON.stringify(Object.fromEntries(map)));
        console.log('done');
    });

    cb();
}

exports.default = build;