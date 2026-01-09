# Receipt Splitter (Frontend)

Simple client-side web app to upload a receipt image, extract text with Tesseract.js, parse item lines and assign items to people to compute splits.

How to run locally

1. Start a simple static server from the project folder (macOS):

```bash
cd /Users/jackliu/Desktop/ReceiptSite
python3 -m http.server 5500

# then open http://localhost:5500 in your browser
```

Usage
- Upload or drag an image into the file input.
- Click "Scan Receipt" to run OCR.
- Inspect the raw OCR text and parsed items.
- Add people, check boxes next to items to assign them.
- Totals update automatically and distribute item price equally when multiple assignees are selected.

Notes
- Parsing tries to find the last monetary value on each line. It may need manual fixes in the raw text box for difficult receipts.
- This is a minimal frontend prototype — consider server-side OCR or improved parsing for production.
