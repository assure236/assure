import PyPDF2
import os

pdfs = ['Annexure-A.pdf', 'Checklist.pdf', 'SDA.pdf', 'source_code_ip_assignment_deed_assure_chits.pdf']

for pdf_file in pdfs:
    print('\n' + '='*60)
    print(f'ANALYZING: {pdf_file}')
    print('='*60 + '\n')
    
    if not os.path.exists(pdf_file):
        print(f'File not found: {pdf_file}')
        continue
    
    try:
        with open(pdf_file, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            num_pages = len(pdf_reader.pages)
            
            print(f'Total Pages: {num_pages}\n')
            
            for page_num in range(num_pages):
                print(f'--- Page {page_num + 1} ---')
                page = pdf_reader.pages[page_num]
                text = page.extract_text()
                print(text)
                print('\n')
                
    except Exception as e:
        print(f'Error reading {pdf_file}: {str(e)}')
