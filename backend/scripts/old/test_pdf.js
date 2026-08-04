const PDFDocument = require('pdfkit');
const fs = require('fs');
const doc = new PDFDocument();
doc.pipe(fs.createWriteStream('/tmp/test_assure.pdf'));
doc.fontSize(20).text('Test PDF from Assure');
doc.end();
doc.on('finish', () => {
  const s = fs.statSync('/tmp/test_assure.pdf');
  console.log('PDF created, size:', s.size, 'bytes');
  process.exit(0);
});
