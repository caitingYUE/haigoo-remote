import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { JOB_CATEGORY_OPTIONS } from './lib/shared/job-categories.js';

const source = ts.transpileModule(fs.readFileSync('src/utils/job-category-search.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports });
const { rankJobCategories } = module.exports;

const options = ['后端开发', '前端开发', '产品经理', '数据分析', '市场营销'];
assert.equal(rankJobCategories(options, '产品经理').at(0), '产品经理');
assert.equal(rankJobCategories(options, 'front').at(0), '前端开发');
assert.equal(rankJobCategories(options, 'backend').at(0), '后端开发');
assert.equal(rankJobCategories(options, '数据').at(0), '数据分析');
// Values returned by vm have a different Array prototype; compare in this realm.
assert.deepEqual(Array.from(rankJobCategories(options, '')), options);
assert.deepEqual(Array.from(rankJobCategories(options, '不存在')), []);
assert.equal(rankJobCategories(JOB_CATEGORY_OPTIONS, '产品设计')[0], '产品设计');
assert.equal(rankJobCategories(JOB_CATEGORY_OPTIONS, '用户调研')[0], '用户研究');
assert.equal(rankJobCategories(JOB_CATEGORY_OPTIONS, '产经')[0], '产品经理');
assert.equal(rankJobCategories(JOB_CATEGORY_OPTIONS, 'ｂａｃｋｅｎｄ')[0], '后端开发');
assert.equal(rankJobCategories(JOB_CATEGORY_OPTIONS, 'UI UX')[0], 'UI/UX设计');
assert.equal(rankJobCategories(JOB_CATEGORY_OPTIONS, ' FRONT ')[0], '前端开发');
assert(!rankJobCategories(JOB_CATEGORY_OPTIONS, 'chair').includes('数据科学'));
assert.deepEqual(Array.from(rankJobCategories(options, '数据 不存在')), []);
assert.deepEqual(Array.from(rankJobCategories(options, '---')), []);
assert.deepEqual(Array.from(rankJobCategories(['历史分类', '后端开发', '后端开发'], '')), ['历史分类', '后端开发']);
assert(rankJobCategories(JOB_CATEGORY_OPTIONS, '设计').every(value => JOB_CATEGORY_OPTIONS.includes(value)));
console.log('Job category search ranking checks passed');
