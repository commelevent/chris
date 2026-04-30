import * as XLSX from 'xlsx';
import * as path from 'path';

const filePath = path.join(__dirname, '../../网络团队-每日性能分析自动化表格数据源.xlsx');

console.log('读取 Excel 文件:', filePath);

try {
  const workbook = XLSX.readFile(filePath);
  
  console.log('\n=== 工作表列表 ===');
  console.log('工作表名称:', workbook.SheetNames);
  
  for (const sheetName of workbook.SheetNames) {
    console.log(`\n\n=== 工作表: ${sheetName} ===`);
    const worksheet = workbook.Sheets[sheetName];
    
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    console.log('行数:', jsonData.length);
    
    if (jsonData.length > 0) {
      console.log('\n前 5 行数据:');
      for (let i = 0; i < Math.min(5, jsonData.length); i++) {
        console.log(`第 ${i + 1} 行:`, JSON.stringify(jsonData[i], null, 2));
      }
      
      console.log('\n列数:', jsonData[0]?.length || 0);
      
      if (jsonData[0]) {
        console.log('\n表头:', jsonData[0]);
      }
    }
  }
} catch (error) {
  console.error('读取文件失败:', error);
}
