// @vitest-environment node
import {afterEach, describe, expect, it, vi} from 'vitest';
import {normalizePolicyResult} from '../policy.js';

const reason = 'Expected true or {allowed: false, reason: non-empty string}; treating the result as a denial';
afterEach(() => vi.unstubAllEnvs());

// #9 decision Q7, shared with selection (#11): fail closed, identically in production and development.
describe('policy result normalization', () => {
    it('allows only the exact value true', () => {
        expect(normalizePolicyResult(true, 'interactionPolicy.canMoveItem')).toStrictEqual({allowed: true});
    });
    it.each(['Locked', ' Weekend ', 'x'])('denies with the reason %j as returned', value => {
        expect(normalizePolicyResult({allowed: false, reason: value}, 'interactionPolicy.canDropItem')).toStrictEqual({allowed: false, reason: value});
    });
    it.each([
        ['false', false], ['undefined', undefined], ['null', null], ['0', 0], ['1', 1], ['a string', 'Locked'],
        ['{allowed: false} without a reason', {allowed: false}], ['a non-string reason', {allowed: false, reason: 42}],
        ['an empty reason', {allowed: false, reason: ''}], ['a blank reason', {allowed: false, reason: ' \n\t'}],
        ['{allowed: true}', {allowed: true}], ['{allowed: "false"}', {allowed: 'false', reason: 'Locked'}],
        ['a reason without allowed', {reason: 'Locked'}], ['{allowed: 0}', {allowed: 0, reason: 'Locked'}], ['{allowed: null}', {allowed: null, reason: 'Locked'}],
        ['a Promise', Promise.resolve(true)], ['a thenable', {then: () => undefined}], ['an array', [true]],
        ['an array carrying the fields', Object.assign([], {allowed: false, reason: 'Locked'})], ['a function', () => true],
    ])('treats %s as a denial with one diagnostic', (_label, value) => {
        expect(normalizePolicyResult(value, 'interactionPolicy.canSelectDate')).toStrictEqual(
            {allowed: false, reason: undefined, diagnostic: {path: 'interactionPolicy.canSelectDate', reason}});
    });
    it('reads only allowed and reason, without spreading or cloning the result', () => {
        const read: PropertyKey[] = [];
        const result = new Proxy({allowed: false, reason: 'Locked', extra: 1}, {
            get: (target, key) => { read.push(key); return Reflect.get(target, key); },
            ownKeys: () => { throw new Error('the result was enumerated'); },
            getOwnPropertyDescriptor: () => { throw new Error('the result was inspected'); },
        });
        expect(normalizePolicyResult(result, 'interactionPolicy.canDropItem')).toStrictEqual({allowed: false, reason: 'Locked'});
        expect(read.sort()).toEqual(['allowed', 'reason']);
    });
    it('keeps the denial but builds no diagnostic text in production', () => {
        vi.stubEnv('NODE_ENV', 'production');
        expect(normalizePolicyResult(false, 'interactionPolicy.canMoveItem')).toStrictEqual({allowed: false, reason: undefined});
        expect(normalizePolicyResult({allowed: false, reason: 'Locked'}, 'interactionPolicy.canMoveItem')).toStrictEqual({allowed: false, reason: 'Locked'});
        expect(normalizePolicyResult(true, 'interactionPolicy.canMoveItem')).toStrictEqual({allowed: true});
    });
});
