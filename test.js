import fs from 'fs';
import test from 'ava';
import yaml from 'js-yaml';

// Test all exports
test('PostgresQL flavor exported correctly', t =>
    t.truthy(require('./src').postgres));
test('MySQL flavor exported correctly', t => t.truthy(require('./src').mysql));
test('MSSQL flavor exported correctly', t => t.truthy(require('./src').mssql));
test('Parser exported correctly', t => t.truthy(require('./src').parser));

// Test query generation
import { parser, postgres as dql } from './src';

const tests = yaml.safeLoad(fs.readFileSync('tests.yml', 'utf8'));

test('Should handle preprocessed data correctly', t => {
    const entry = tests[1];
    const config = entry.config || {};
    const parsed = parser.parse(entry.document);
    const processed = dql(parsed)(config, true);

    return t.is(processed, entry.expected.replace(/\s+/g, ' ').trim());
});

tests.forEach(entry => {
    const config = entry.config || {};

    if (!entry.expected)
        test(entry.name, t => t.throws(() => dql`${entry.document}`()));
    else
        test(entry.name, t =>
            t.is(
                dql`${entry.document}`(config, true),
                entry.expected.replace(/\s+/g, ' ').trim()
            )
        );
});
