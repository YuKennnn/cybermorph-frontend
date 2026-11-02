/* global process */
import assert from 'node:assert'
import {
  PLAY_DATA_COLUMNS,
  formatCsvValue,
  formatPlayDataCsv,
  decodePlayDataPayload,
  getPlayDataFilename,
  getAllPlayDataFilename,
  processAllPlayDataExport,
} from '../src/utils/playDataExport.js'

async function runTests() {
  console.log('--- Test 1: PLAY_DATA_COLUMNS count & ordering ---')
  assert.strictEqual(PLAY_DATA_COLUMNS.length, 22, 'Must have exactly 22 columns')
  assert.strictEqual(PLAY_DATA_COLUMNS[0], 'participant_code')
  assert.strictEqual(PLAY_DATA_COLUMNS[1], 'session_id')
  assert.strictEqual(PLAY_DATA_COLUMNS[2], 'attack_log_id')
  assert.strictEqual(PLAY_DATA_COLUMNS[21], 'build_version')
  console.log('✓ Columns verified')

  console.log('--- Test 2: formatCsvValue behavior ---')
  assert.strictEqual(formatCsvValue(true), 'True')
  assert.strictEqual(formatCsvValue(false), 'False')
  assert.strictEqual(formatCsvValue(null), '')
  assert.strictEqual(formatCsvValue(undefined), '')
  assert.strictEqual(formatCsvValue(0), '0')
  assert.strictEqual(formatCsvValue('simple'), 'simple')
  assert.strictEqual(formatCsvValue('has,comma'), '"has,comma"')
  assert.strictEqual(formatCsvValue('has"quote'), '"has""quote"')
  assert.strictEqual(formatCsvValue('has\nnewline'), '"has\nnewline"')
  console.log('✓ formatCsvValue verified')

  console.log('--- Test 3: Test vector from PLAY_DATA_GUIDE.md ---')
  const samplePayload = `CMLOG1:H4sIAAAAAAAC/9VSwWrcMBD9laBTCrtBdrNp4nshPRQCu6eWIMbyeHdYWTLSOGEJ+feO7N00pSYp9JTBjPHTzBvN83tSPUQmSz14NjY0qCq1+bre6EItVAyPSVU/n94sSpgSBW+oETQtMwTMYPfGhe2EFsdYjukyp+vT5ykyk0UPkcLUdHf7zehxAu8iAhs+9Hnw3Y7SjvxWDigZh1ti6oDREGOnqhZcwldcDbUt2cHxQXprqfYeo/T2Dg4YDViWy+cjF+wem4nVhhjRsqo4DkJmIzbEyUDbCipFVaFFHUx98AmNzEfTiVLFSgsua2+xMSDtqtTllay51MVGf6m0lueHjAixkdnkzVE8af0tpB+6Wq6YIbkKDxwigXvZTLAaEjry+IL1O0FkXBy8sHfQGw9dBm6DvIR6T86JVg/oTFaSxsNXaggfjkqYPjiyWaupOnEkEeKPihhqqMlRllRfrBaqHsg15gHjtIsqz85H6KwoPqnnxX/7pzzGckyXOV2fPk/xl3/W3+f9s+7e9M/0x+ftQ54xduIFKZ+xEDgXHv/ZQqs5B5Wf33fQzbyDyg/roPJdC90//wIdiNm/qQQAAA==`

  const decoded = await decodePlayDataPayload(samplePayload)
  assert.strictEqual(decoded.ok, true, 'Sample payload should decode successfully')
  assert.strictEqual(decoded.participant_code, 'TEST01')
  assert.strictEqual(decoded.rows.length, 2)

  const csv = formatPlayDataCsv(decoded.rows)
  const expectedCsv =
`participant_code,session_id,attack_log_id,scenario_id,threat_type,is_legitimate_item,scenario_difficulty,player_action,is_correct,credits_affected,response_time_ms,logged_at,order_in_session,session_number,is_tutorial,is_baseline,phase,map_name,skill_level_at_time,selection_policy,selection_probability,build_version
TEST01,s-1,11111111-1111-4111-8111-111111111111,PHI_001,Phishing,False,beginner,blocked,True,10,1500,2026-11-01T07:00:00Z,1,1,False,False,run,Home,beginner,level_strict,0.5,2 (build 11)
TEST01,s-1,22222222-2222-4222-8222-222222222222,SMI_001,Smishing,True,intermediate,allowed,True,5,2300,2026-11-01T07:00:09Z,2,1,False,False,run,Home,beginner,level_strict,0.25,2 (build 11)
`

  assert.strictEqual(csv, expectedCsv, 'CSV output must match PLAY_DATA_GUIDE.md sample byte-for-byte')
  console.log('✓ Guide test vector matches exactly')

  console.log('--- Test 4: Malformed, empty, truncated payloads ---')
  const emptyRes = await decodePlayDataPayload('')
  assert.strictEqual(emptyRes.ok, false)

  const noPrefixRes = await decodePlayDataPayload('H4sIAAAAAAAC/9VSwWrcMBD9...')
  assert.strictEqual(noPrefixRes.ok, false)

  const truncatedRes = await decodePlayDataPayload(samplePayload.slice(0, 100))
  assert.strictEqual(truncatedRes.ok, false)

  const nonStringRes = await decodePlayDataPayload(12345)
  assert.strictEqual(nonStringRes.ok, false)
  console.log('✓ Error handling for invalid payloads verified')

  console.log('--- Test 5: Filenames ---')
  const testDate = new Date('2026-11-01T12:00:00Z')
  assert.strictEqual(getPlayDataFilename('TEST01', testDate), 'play-data-TEST01-2026-11-01.csv')
  assert.strictEqual(getPlayDataFilename('K7M/2Q!X', testDate), 'play-data-K7M2QX-2026-11-01.csv')
  assert.strictEqual(getAllPlayDataFilename(testDate), 'play-data-all-2026-11-01.csv')
  console.log('✓ Filenames verified')

  console.log('--- Test 6: Bulk processAllPlayDataExport with concurrency <= 3 ---')
  let activeConcurrent = 0
  let maxConcurrent = 0

  const mockItems = [
    { upload_id: 'u1', participant_code: 'TEST01', row_count: 2 },
    { upload_id: 'u2', participant_code: 'TEST02', row_count: 2 },
    { upload_id: 'u3', participant_code: 'TEST03', row_count: 999 }, // row count mismatch
    { upload_id: 'u4', participant_code: 'BAD01', row_count: 1 }, // malformed
  ]

  const fetchPage = async () => ({ items: mockItems, total_count: 4 })
  const fetchDetail = async (id) => {
    activeConcurrent++
    maxConcurrent = Math.max(maxConcurrent, activeConcurrent)
    await new Promise((r) => setTimeout(r, 20))
    activeConcurrent--

    if (id === 'u4') {
      return { payload: 'CMLOG1:corrupted' }
    }
    return { payload: samplePayload, row_count: 2 }
  }

  const bulkRes = await processAllPlayDataExport({
    fetchPage,
    fetchDetail,
  })

  assert.strictEqual(bulkRes.ok, true)
  assert.ok(maxConcurrent <= 3, `Max concurrent requests was ${maxConcurrent}, expected <= 3`)
  assert.strictEqual(bulkRes.totalUploads, 4)
  assert.strictEqual(bulkRes.processedCount, 3)
  assert.strictEqual(bulkRes.unreadableUploads.length, 1)
  assert.strictEqual(bulkRes.unreadableUploads[0].upload_id, 'u4')
  assert.strictEqual(bulkRes.mismatchedUploads.length, 1)
  assert.strictEqual(bulkRes.mismatchedUploads[0].upload_id, 'u3')
  // Check deduplication: u1, u2, u3 all have the same samplePayload attack_log_ids ('1111...', '2222...')
  // So total deduplicated rows must be 2, not 6!
  assert.strictEqual(bulkRes.totalRows, 2, 'Should deduplicate rows by attack_log_id')
  console.log('✓ Bulk processing, concurrency <= 3, and deduplication verified')

  console.log('--- Test 7: Bulk export where 100% fail ---')
  const allFailRes = await processAllPlayDataExport({
    fetchPage: async () => ({ items: [{ upload_id: 'bad1' }], total_count: 1 }),
    fetchDetail: async () => ({ payload: 'invalid' }),
  })
  assert.strictEqual(allFailRes.ok, false)
  assert.ok(allFailRes.error.includes('All play data uploads failed'))
  console.log('✓ 100% failure handled properly')

  console.log('\n=========================================')
  console.log('ALL UNIT TESTS PASSED!')
  console.log('=========================================')
}

runTests().catch((e) => {
  console.error('TEST FAILED:', e)
  process.exit(1)
})
