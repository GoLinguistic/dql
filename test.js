import fs from 'fs';
import test from 'ava';
import yaml from 'js-yaml';
import { postgres as dql } from './src';

const tests = yaml.safeLoad(fs.readFileSync('tests.yml', 'utf8'));

tests.forEach(entry => {
    const doc = dql`${entry.document}`;

    if (!entry.expected) test(entry.name, t => t.throws(() => doc()));
    else
        test(entry.name, t =>
            t.is(
                doc(entry.config || {}, true),
                entry.expected.replace(/\s+/g, ' ').trim()
            )
        );
});
