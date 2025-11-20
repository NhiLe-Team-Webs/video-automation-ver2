/**
 * Script kiểm tra setup Google Sheets API
 * 
 * Chạy script này để verify setup trước khi test thực tế
 * 
 * Cách chạy:
 * npx tsx src/services/sheetsStorageService.check-setup.ts
 */

import fs from 'fs/promises';
import path from 'path';
import { config } from '../config';

async function checkSetup() {
  console.log('=== Kiểm Tra Setup Google Sheets API ===\n');

  let hasErrors = false;

  // 1. Kiểm tra file .env
  console.log('1. Kiểm tra file .env...');
  try {
    const envPath = path.join(process.cwd(), '.env');
    await fs.access(envPath);
    console.log('   ✓ File .env tồn tại');

    // Kiểm tra các biến môi trường
    if (config.googleSheets.spreadsheetId) {
      console.log(`   ✓ GOOGLE_SHEETS_SPREADSHEET_ID: ${config.googleSheets.spreadsheetId}`);
    } else {
      console.log('   ✗ GOOGLE_SHEETS_SPREADSHEET_ID chưa được set');
      hasErrors = true;
    }

    if (config.googleSheets.credentials) {
      console.log(`   ✓ GOOGLE_SHEETS_CREDENTIALS: ${config.googleSheets.credentials}`);
    } else {
      console.log('   ✗ GOOGLE_SHEETS_CREDENTIALS chưa được set');
      hasErrors = true;
    }
  } catch (error) {
    console.log('   ✗ File .env không tồn tại');
    hasErrors = true;
  }
  console.log();

  // 2. Kiểm tra file credentials
  console.log('2. Kiểm tra file credentials...');
  try {
    const credPath = path.join(process.cwd(), config.googleSheets.credentials);
    const credContent = await fs.readFile(credPath, 'utf-8');
    const credentials = JSON.parse(credContent);

    console.log('   ✓ File credentials tồn tại và là JSON hợp lệ');

    if (credentials.client_email) {
      console.log(`   ✓ Service Account Email: ${credentials.client_email}`);
      console.log(`\n   📧 QUAN TRỌNG: Hãy share Google Sheet với email này!`);
    } else {
      console.log('   ✗ Thiếu field "client_email" trong credentials');
      hasErrors = true;
    }

    if (credentials.private_key) {
      console.log('   ✓ Private key có trong credentials');
    } else {
      console.log('   ✗ Thiếu field "private_key" trong credentials');
      hasErrors = true;
    }

    if (credentials.project_id) {
      console.log(`   ✓ Project ID: ${credentials.project_id}`);
      console.log(`\n   🔗 Link enable API: https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=${credentials.project_id}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        console.log(`   ✗ File credentials không tồn tại: ${config.googleSheets.credentials}`);
      } else if (error.message.includes('JSON')) {
        console.log('   ✗ File credentials không phải JSON hợp lệ');
      } else {
        console.log(`   ✗ Lỗi đọc credentials: ${error.message}`);
      }
    }
    hasErrors = true;
  }
  console.log();

  // 3. Test kết nối
  console.log('3. Test kết nối Google Sheets API...');
  try {
    const { SheetsStorageService } = await import('./sheetsStorageService');
    const service = new SheetsStorageService();
    
    console.log('   → Đang khởi tạo service...');
    await service.initialize();
    console.log('   ✓ Khởi tạo thành công!');

    console.log('   → Đang test quyền truy cập spreadsheet...');
    // Try to get data (even if empty)
    try {
      await service.getTranscript('test-connection-check');
      console.log('   ✓ Có thể truy cập spreadsheet!');
    } catch (error: any) {
      if (error.message.includes('not been used') || error.message.includes('disabled')) {
        console.log('   ✗ Google Sheets API chưa được enable!');
        console.log('   → Vui lòng enable API tại link ở trên');
        hasErrors = true;
      } else if (error.message.includes('permission')) {
        console.log('   ✗ Service Account chưa có quyền truy cập spreadsheet!');
        console.log('   → Vui lòng share sheet với Service Account email ở trên');
        hasErrors = true;
      } else if (error.message.includes('not found')) {
        console.log('   ✗ Spreadsheet không tồn tại hoặc ID không đúng!');
        console.log(`   → Kiểm tra lại GOOGLE_SHEETS_SPREADSHEET_ID: ${config.googleSheets.spreadsheetId}`);
        hasErrors = true;
      } else {
        console.log(`   ✗ Lỗi: ${error.message}`);
        hasErrors = true;
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.log(`   ✗ Lỗi khởi tạo: ${error.message}`);
    }
    hasErrors = true;
  }
  console.log();

  // Kết luận
  console.log('=== KẾT QUẢ ===');
  if (hasErrors) {
    console.log('❌ Setup chưa hoàn tất. Vui lòng fix các lỗi ở trên.\n');
    console.log('📚 Xem hướng dẫn chi tiết tại: TESTING_GOOGLE_SHEETS.md\n');
    process.exit(1);
  } else {
    console.log('✅ Setup hoàn tất! Bạn có thể chạy test ngay.\n');
    console.log('Chạy test:');
    console.log('  npx tsx src/services/sheetsStorageService.simple-test.ts\n');
    process.exit(0);
  }
}

checkSetup();
