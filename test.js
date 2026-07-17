const pdfParseImport = require("pdf-parse");
const pdfParse = (typeof pdfParseImport === "function") 
  ? pdfParseImport 
  : (pdfParseImport.default || pdfParseImport);
console.log(typeof pdfParse);
