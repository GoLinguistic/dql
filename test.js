import fs from 'fs';
import path from 'path';
import test from 'ava';
import yaml from 'js-yaml';
import { Parser } from 'jison';

// Test all exports
test('PostgresQL flavor exported correctly', t =>
    t.truthy(require('./src').postgres));
test('MySQL flavor exported correctly', t => t.truthy(require('./src').mysql));
test('MSSQL flavor exported correctly', t => t.truthy(require('./src').mssql));
test('Parser exported correctly', t => t.truthy(require('./src').parser));

// Test query generation
import { postgres as dql } from './src';

const grammar = fs.readFileSync(
    path.join(__dirname, './cfg/grammar.jison'),
    'utf8'
);
const parser = new Parser(grammar);
const tests = yaml.safeLoad(fs.readFileSync('tests.yml', 'utf8'));

tests.forEach(entry => {
    const config = entry.config || {};

    if (!entry.expected)
        test(entry.name, t =>
            t.throws(() => dql(parser.parse(entry.document))())
        );
    else
        test(entry.name, t =>
            t.is(
                dql(parser.parse(entry.document))(config, true),
                entry.expected.replace(/\s+/g, ' ').trim()
            )
        );
});
