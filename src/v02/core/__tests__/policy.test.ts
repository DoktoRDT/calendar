// @vitest-environment node
import {describe, expect, it} from 'vitest';
import type {PolicyResult} from '../../reference.js';
import {normalizePolicyResult} from '../policy.js';

const path = 'interactionPolicy.canSelectDate';
const diagnostic = {path, reason: 'Expected true or {allowed: false, reason: non-empty string}; treating the result as a denial'};

describe('PolicyResult normalization (#9 decision Q7, #11 decision Q6)', () => {
    it('allows exactly true and denies with a non-blank reason as returned', () => {
        expect(normalizePolicyResult(true, path)).toEqual({allowed: true});
        expect(normalizePolicyResult({allowed: false, reason: '  Closed  '}, path)).toEqual({allowed: false, reason: '  Closed  '});
    });
    it.each<[string, unknown]>([
        ['an empty reason', {allowed: false, reason: ''}], ['a blank reason', {allowed: false, reason: ' \n\t'}], ['a missing reason', {allowed: false}],
        ['a non-string reason', {allowed: false, reason: 42}], ['{allowed: true}', {allowed: true}], ['false', false], ['undefined', undefined], ['null', null],
        ['0', 0], ['a string', 'no'], ['an array', [false, 'reason']], ['a thenable', {then() {}}], ['a Promise', Promise.resolve(true)],
    ])('%s fails closed with genericBlockedReason and one diagnostic', (_label, result) => {
        expect(normalizePolicyResult(result as PolicyResult, path)).toEqual({allowed: false, reason: undefined, diagnostic});
    });
    it('reads only allowed and reason, never spreading or cloning the result', () => {
        const read: PropertyKey[] = [];
        const result = new Proxy<{allowed: false; reason: string}>({allowed: false, reason: 'Closed'}, {get: (target, key) => { read.push(key); return Reflect.get(target, key); },
            ownKeys: () => { throw new Error('enumerated'); }, getOwnPropertyDescriptor: () => { throw new Error('described'); }});
        expect(normalizePolicyResult(result, path)).toEqual({allowed: false, reason: 'Closed'});
        expect(read).toEqual(['allowed', 'reason']);
    });
});
