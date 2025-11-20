/**
 * Manual test script for uploading SRT to Google Sheets
 * 
 * Cách chạy:
 * 1. Đảm bảo file .env đã có GOOGLE_SHEETS_SPREADSHEET_ID và GOOGLE_SHEETS_CREDENTIALS
 * 2. Chạy: npx tsx src/services/sheetsStorageService.manual-test.ts
 */

import { SheetsStorageService } from './sheetsStorageService';
import { TranscriptionService, TranscriptSegment } from './transcriptionService';
import fs from 'fs/promises';
import path from 'path';

async function testUploadSRTToSheets() {
  console.log('=== Test Upload SRT to Google Sheets ===\n');

  try {
    // 1. Khởi tạo services
    console.log('1. Khởi tạo services...');
    const sheetsService = new SheetsStorageService();
    const transcriptionService = new TranscriptionService();
    
    await sheetsService.initialize();
    console.log('✓ Services đã khởi tạo\n');

    // 2. Đọc file SRT
    const srtPath = path.join(process.cwd(), 'temp', 'test-video_edited.srt');
    console.log(`2. Đọc file SRT: ${srtPath}`);
    
    // Kiểm tra file có tồn tại không
    try {
      await fs.access(srtPath);
      console.log('✓ File SRT tồn tại\n');
    } catch (error) {
      console.error('✗ File SRT không tồn tại!');
      console.log('\nVui lòng đảm bảo file temp/test-video_edited.srt tồn tại');
      console.log('Hoặc thay đổi đường dẫn trong script này\n');
      return;
    }

    // 3. Parse SRT file thành segments
    console.log('3. Parse SRT file...');
    const segments = await (transcriptionService as any).parseSRT(srtPath);
    console.log(`✓ Đã parse ${segments.length} segments\n`);

    // Hiển thị một vài segments đầu tiên
    console.log('Preview segments (3 đầu tiên):');
    segments.slice(0, 3).forEach((seg: TranscriptSegment, idx: number) => {
      console.log(`  ${idx + 1}. [${seg.start.toFixed(2)}s - ${seg.end.toFixed(2)}s] ${seg.text.substring(0, 50)}...`);
    });
    console.log();

    // 4. Upload lên Google Sheets
    const jobId = `test-job-${Date.now()}`;
    console.log(`4. Upload lên Google Sheets với Job ID: ${jobId}`);
    
    const updatedRange = await sheetsService.saveTranscript(jobId, segments);
    console.log(`✓ Đã upload thành công!`);
    console.log(`  Range: ${updatedRange}\n`);

    // 5. Retrieve lại để verify
    console.log('5. Retrieve lại từ Google Sheets để verify...');
    const retrievedSegments = await sheetsService.getTranscript(jobId);
    console.log(`✓ Đã retrieve ${retrievedSegments.length} segments\n`);

    // 6. So sánh dữ liệu
    console.log('6. Kiểm tra tính toàn vẹn dữ liệu (round-trip)...');
    
    let allMatch = true;
    let mismatchCount = 0;

    if (segments.length !== retrievedSegments.length) {
      console.log(`✗ Số lượng segments không khớp: ${segments.length} vs ${retrievedSegments.length}`);
      allMatch = false;
    } else {
      for (let i = 0; i < segments.length; i++) {
        const original = segments[i];
        const retrieved = retrievedSegments[i];

        const startMatch = Math.abs(original.start - retrieved.start) < 0.001;
        const endMatch = Math.abs(original.end - retrieved.end) < 0.001;
        const textMatch = original.text === retrieved.text;

        if (!startMatch || !endMatch || !textMatch) {
          mismatchCount++;
          if (mismatchCount <= 3) { // Chỉ hiển thị 3 lỗi đầu tiên
            console.log(`\n  Segment ${i + 1} không khớp:`);
            if (!startMatch) console.log(`    Start: ${original.start} vs ${retrieved.start}`);
            if (!endMatch) console.log(`    End: ${original.end} vs ${retrieved.end}`);
            if (!textMatch) console.log(`    Text: "${original.text}" vs "${retrieved.text}"`);
          }
          allMatch = false;
        }
      }
    }

    if (allMatch) {
      console.log('✓ TẤT CẢ DỮ LIỆU KHỚP HOÀN TOÀN! Round-trip thành công!\n');
    } else {
      console.log(`✗ Có ${mismatchCount} segments không khớp\n`);
    }

    // 7. Thống kê
    console.log('=== THỐNG KÊ ===');
    console.log(`Job ID: ${jobId}`);
    console.log(`Tổng số segments: ${segments.length}`);
    console.log(`Tổng thời lượng: ${segments[segments.length - 1]?.end.toFixed(2)}s`);
    console.log(`Google Sheets Range: ${updatedRange}`);
    console.log(`Round-trip: ${allMatch ? 'PASSED ✓' : 'FAILED ✗'}`);
    console.log('\n=== HOÀN THÀNH ===\n');

  } catch (error) {
    console.error('\n✗ LỖI:', error);
    if (error instanceof Error) {
      console.error('Chi tiết:', error.message);
      console.error('Stack:', error.stack);
    }
  }
}

// Chạy test
testUploadSRTToSheets();
