import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkQuestion, parseCsv, parseQuestions, SAMPLE_CSV, SAMPLE_JSON } from './questionImport.js'

const ID = '6ab8e8dbcc445f6ad2a9fd6f'

test('CSV: ô có dấu phẩy / dấu nháy / xuống dòng, correct nhiều phương án, card_ids nhiều id', () => {
  const rows = parseCsv('a,"b, c","d ""e""",f\n1,2,"x\ny",4\n')
  assert.deepEqual(rows, [['a', 'b, c', 'd "e"', 'f'], ['1', '2', 'x\ny', '4']])
  const qs = parseQuestions(SAMPLE_CSV.replaceAll('<id thẻ 24 ký tự hex>', ID).replaceAll('<id thẻ>', `${ID};${ID}`))
  assert.equal(qs.length, 2)
  assert.equal(qs[0].kind, 'single')
  assert.deepEqual(qs[0].options.map((o) => o.correct), [true, false, false, false])
  assert.equal(qs[0].difficulty, 2)
  assert.equal(qs[0].bloom, 'remember')
  assert.deepEqual(qs[0].card_ids, [ID])
  assert.deepEqual(qs[1].options.map((o) => o.correct), [true, true, false])
  assert.equal(qs[1].bloom, null)
  assert.deepEqual(qs[1].card_ids, [ID, ID])
  assert.deepEqual(qs.map(checkQuestion), [[], []])
})

test('JSON: mảng hoặc {questions}; kiểm tra luật 17.6', () => {
  const json = JSON.stringify(SAMPLE_JSON).replaceAll('<id thẻ 24 ký tự hex>', ID).replaceAll('<id thẻ>', ID)
  assert.equal(parseQuestions(json).length, 3)
  assert.equal(parseQuestions(`{"questions": ${json}}`).length, 3)
  assert.deepEqual(parseQuestions(json).map(checkQuestion), [[], [], []])
  assert.throws(() => parseQuestions('{"x": 1}'), /mảng/)
  const errs = checkQuestion({ kind: 'single', stem: '', card_ids: ['abc'], options: [{ text: 'a', correct: true }, { text: 'b', correct: true }] })
  assert.ok(errs.some((e) => e.includes('stem')))
  assert.ok(errs.some((e) => e.includes('24 ký tự')))
  assert.ok(errs.some((e) => e.includes('đúng 1 phương án')))
  assert.deepEqual(checkQuestion({ kind: 'essay', stem: 'x', card_ids: [ID], rubric: [] }), ['tự luận cần rubric ≥ 1 tiêu chí'])
})
